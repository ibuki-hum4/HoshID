import { parseEnvelope } from "better-auth/crypto";

import {
  JWKS_GRACE_PERIOD_SECONDS,
  JWKS_ROTATION_INTERVAL_SECONDS,
  classifyJwk,
  resolveSecretConfig,
  type JwkState,
} from "@/lib/jwks";
import { prisma } from "@/lib/prisma";

/**
 * 鍵まわりの健康診断。
 *
 * **鍵の問題は放っておいても何も起きないのが厄介なところ。** 自動ローテー
 * ションが始まっていなくても、古い秘密が捨てられないままでも、画面は普通に
 * 動き続ける。だから人が覚えておくのではなく、ここで見つけて言わせる。
 *
 * 管理画面・サーバ起動時の警告・保守スクリプトの3か所が同じ判断を使う。
 */

export type KeyIssueCode =
  | "no-expiry"
  | "expiring-soon"
  | "unversioned-ciphertext"
  | "stale-ciphertext"
  | "prunable";

export type KeyIssue = {
  code: KeyIssueCode;
  /** warn = 対処が要る。info = 知っておけばよい。 */
  level: "warn" | "info";
  summary: string;
  /** 何をすればよいか。 */
  action: string;
};

export type KeyRow = {
  id: string;
  alg: string | null;
  crv: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  state: JwkState;
  /** JWKS に公開され続ける期限。期限が無い鍵は null。 */
  publishedUntil: Date | null;
};

export type SecretHealth = {
  /** single = BETTER_AUTH_SECRET のみ。versioned = BETTER_AUTH_SECRETS を使用。 */
  mode: "single" | "versioned";
  currentVersion: number | null;
  knownVersions: number[];
  /** 暗号文の数。version が null のものは版の付いていない古い形式。 */
  ciphertexts: { total: number; unversioned: number; stale: number };
};

export type KeyHealth = {
  keys: KeyRow[];
  secrets: SecretHealth;
  issues: KeyIssue[];
};

/** 再暗号化の対象。ここに挙がっていないものは短命で、放っておけば消える。 */
async function countCiphertexts(): Promise<{
  total: number;
  unversioned: number;
  byVersion: Map<number, number>;
}> {
  const byVersion = new Map<number, number>();
  let total = 0;
  let unversioned = 0;

  const tally = (raw: string) => {
    total += 1;
    const envelope = parseEnvelope(raw);
    if (!envelope) {
      unversioned += 1;
      return;
    }
    byVersion.set(envelope.version, (byVersion.get(envelope.version) ?? 0) + 1);
  };

  const keys = await prisma.jwks.findMany({ select: { privateKey: true } });
  for (const key of keys) {
    // jwks だけ JSON.stringify されて入っている（Better Auth の createJwk がそう書く）。
    const raw = JSON.parse(key.privateKey);
    if (typeof raw === "string") tally(raw);
  }

  const twoFactor = await prisma.twoFactor.findMany({
    select: { secret: true, backupCodes: true },
  });
  for (const row of twoFactor) {
    tally(row.secret);
    tally(row.backupCodes);
  }

  return { total, unversioned, byVersion };
}

export async function inspectKeys(now: Date = new Date()): Promise<KeyHealth> {
  const rows = await prisma.jwks.findMany({ orderBy: { createdAt: "desc" } });

  // 署名に選ばれるのは「期限内のうち最も新しい1本」。Better Auth の
  // getLatestKeyByAlg と同じ判定をここでも行う。
  const latestLive = rows.find((row) => !row.expiresAt || row.expiresAt > now);

  const keys: KeyRow[] = rows.map((row) => ({
    id: row.id,
    alg: row.alg,
    crv: row.crv,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    state: classifyJwk(row, { isLatestLive: row.id === latestLive?.id, now }),
    publishedUntil: row.expiresAt
      ? new Date(row.expiresAt.getTime() + JWKS_GRACE_PERIOD_SECONDS * 1000)
      : null,
  }));

  const secretConfig = resolveSecretConfig();
  const counted = await countCiphertexts();

  const currentVersion =
    typeof secretConfig === "string" ? null : secretConfig.currentVersion;

  const stale =
    currentVersion === null
      ? 0
      : [...counted.byVersion.entries()]
          .filter(([version]) => version !== currentVersion)
          .reduce((sum, [, count]) => sum + count, 0);

  const secrets: SecretHealth = {
    mode: typeof secretConfig === "string" ? "single" : "versioned",
    currentVersion,
    knownVersions:
      typeof secretConfig === "string" ? [] : [...secretConfig.keys.keys()].sort((a, b) => a - b),
    ciphertexts: { total: counted.total, unversioned: counted.unversioned, stale },
  };

  const issues: KeyIssue[] = [];

  if (keys.some((key) => !key.expiresAt)) {
    issues.push({
      code: "no-expiry",
      level: "warn",
      summary: "署名の期限が無い鍵があります。このままでは自動ローテーションが始まりません。",
      action: "`bun run jwks --adopt`（デプロイ時の保守処理でも自動で行われます）",
    });
  }

  const signing = keys.find((key) => key.state === "signing");
  if (signing?.expiresAt) {
    const daysLeft = (signing.expiresAt.getTime() - now.getTime()) / 86_400_000;
    if (daysLeft <= 7) {
      issues.push({
        code: "expiring-soon",
        level: "info",
        summary: `署名鍵の期限まで約${Math.max(0, Math.ceil(daysLeft))}日です。`,
        action: "対処は不要です。期限が切れると次の署名で新しい鍵が作られます。",
      });
    }
  }

  if (secrets.mode === "versioned" && secrets.ciphertexts.unversioned > 0) {
    issues.push({
      code: "unversioned-ciphertext",
      level: "warn",
      summary: `版の付いていない暗号文が ${secrets.ciphertexts.unversioned} 件あります。BETTER_AUTH_SECRET をまだ外せません。`,
      action: "`bun run secrets:reencrypt` で現行版へ書き換えてください。",
    });
  }

  if (secrets.ciphertexts.stale > 0) {
    issues.push({
      code: "stale-ciphertext",
      level: "warn",
      summary: `古い版のままの暗号文が ${secrets.ciphertexts.stale} 件あります。その版の秘密を捨てられません。`,
      action: "`bun run secrets:reencrypt` で現行版へ書き換えてください。",
    });
  }

  const prunable = keys.filter((key) => key.state === "retired").length;
  if (prunable > 0) {
    issues.push({
      code: "prunable",
      level: "info",
      summary: `公開の終わった鍵が ${prunable} 本残っています。`,
      action: "害はありません。`bun run jwks --prune` で消せます。",
    });
  }

  return { keys, secrets, issues };
}

/** 鍵が1本も無いときに、次に作られる鍵の期限がいつになるかの目安。 */
export function nextExpiryFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + JWKS_ROTATION_INTERVAL_SECONDS * 1000);
}
