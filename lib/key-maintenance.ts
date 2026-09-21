import {
  generateRandomString,
  parseEnvelope,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import { generateExportedKeyPair } from "better-auth/plugins/jwt";

import {
  JWKS_GRACE_PERIOD_SECONDS,
  JWKS_KEY_PAIR_CONFIG,
  JWKS_ROTATION_INTERVAL_SECONDS,
  resolveSecretConfig,
} from "@/lib/jwks";
import { inspectKeys } from "@/lib/key-health";
import { prisma } from "@/lib/prisma";

/**
 * 鍵に対する操作の本体。
 *
 * ここの関数は**表示を一切しない**。結果を返すだけにして、対話的な CLI
 * （`scripts/rotate-jwks.ts`）とデプロイ時の自動保守
 * （`scripts/key-maintenance.ts`）の両方から同じ処理を呼べるようにしている。
 *
 * `adopt` / `prune` / `reencrypt` の3つは**何度実行してもよく、実行しても
 * 利用者に影響が出ない**。デプロイのたびに自動で走らせてよいのはこの3つだけ。
 * `rotate` と `revoke` は人が判断して実行するもので、自動化しないこと。
 */

export type Jwk = {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  alg: string | null;
  crv: string | null;
};

/**
 * 新しい鍵を作る。
 *
 * Better Auth の `createJwk` と同じ形で作らないと、サーバが復号できない鍵が
 * できる。鍵の生成も暗号化もライブラリの関数をそのまま使い、こちらで実装し
 * 直さないこと。
 */
export async function mintKey(): Promise<Jwk> {
  const { publicWebKey, privateWebKey, alg } = await generateExportedKeyPair({
    jwks: { keyPairConfig: JWKS_KEY_PAIR_CONFIG },
  });

  const encrypted = await symmetricEncrypt({
    key: resolveSecretConfig(),
    data: JSON.stringify(privateWebKey),
  });

  return prisma.jwks.create({
    data: {
      // kid になる。Better Auth のアダプタと同じ長さ・文字種に揃える。
      id: generateRandomString(32, "a-z", "A-Z", "0-9"),
      publicKey: JSON.stringify(publicWebKey),
      privateKey: JSON.stringify(encrypted),
      alg,
      crv: JWKS_KEY_PAIR_CONFIG.crv,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + JWKS_ROTATION_INTERVAL_SECONDS * 1000),
    },
  });
}

export type AdoptedKey = { id: string; expiresAt: Date; overdue: boolean };

/**
 * 期限の無い鍵に、作成時からの期限を打つ。
 *
 * `rotationInterval` は**新しく作る鍵にしか効かない**。設定を入れる前から
 * ある鍵は期限が空のままで、いつまでも署名に使われ続ける。しかもエラーは
 * 何も出ないので、気づく手がかりが無い。だからデプロイのたびに走らせる。
 */
export async function adoptKeys(now: Date = new Date()): Promise<AdoptedKey[]> {
  const targets = await prisma.jwks.findMany({ where: { expiresAt: null } });
  const adopted: AdoptedKey[] = [];

  for (const key of targets) {
    const expiresAt = new Date(
      key.createdAt.getTime() + JWKS_ROTATION_INTERVAL_SECONDS * 1000,
    );

    await prisma.jwks.update({ where: { id: key.id }, data: { expiresAt } });
    adopted.push({ id: key.id, expiresAt, overdue: expiresAt <= now });
  }

  return adopted;
}

/** 公開期間も終えた鍵の行を消す。署名にも検証にも使われていないもの。 */
export async function pruneKeys(now: Date = new Date()): Promise<string[]> {
  const { keys } = await inspectKeys(now);
  const targets = keys.filter((key) => key.state === "retired");

  for (const key of targets) {
    await prisma.jwks.delete({ where: { id: key.id } });
  }

  return targets.map((key) => key.id);
}

export type RotateResult = { created: Jwk; retired: { id: string; publishedUntil: Date }[] };

/**
 * 予定を待たずに次の鍵へ切り替える。
 *
 * 古い鍵はここで消さない。消すと、その鍵で署名された有効期限内のトークンが
 * 全て検証できなくなる。猶予期間のあいだ JWKS に残し、静かに退場させる。
 */
export async function rotateKeys(now: Date = new Date()): Promise<RotateResult> {
  const live = await prisma.jwks.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });

  const created = await mintKey();
  const retired: RotateResult["retired"] = [];

  for (const key of live) {
    await prisma.jwks.update({ where: { id: key.id }, data: { expiresAt: now } });
    retired.push({
      id: key.id,
      publishedUntil: new Date(now.getTime() + JWKS_GRACE_PERIOD_SECONDS * 1000),
    });
  }

  return { created, retired };
}

export type RevokeResult =
  | { ok: false; reason: "not-found" }
  | { ok: true; replacement: Jwk | null };

/**
 * 鍵を即座に消す。**漏洩したときだけ。**
 *
 * JWKS から消えるので、その鍵で署名されたトークンは全て検証できなくなる。
 * 漏れた鍵で偽のトークンを作られている可能性がある以上、それが正しい。
 */
export async function revokeKey(kid: string, now: Date = new Date()): Promise<RevokeResult> {
  const target = await prisma.jwks.findUnique({ where: { id: kid } });
  if (!target) return { ok: false, reason: "not-found" };

  const remaining = await prisma.jwks.count({
    where: {
      id: { not: kid },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  // 消した後に署名できる鍵が無いと、次の要求で自動生成が走る。それでも動くが、
  // 生成の失敗が「利用者のログインが落ちる」という形で現れる。先に作っておく。
  const replacement = remaining === 0 ? await mintKey() : null;

  await prisma.jwks.delete({ where: { id: kid } });

  return { ok: true, replacement };
}

// --- 秘密の版の入れ替え -----------------------------------------------------

export type ReencryptCounts = { converted: number; skipped: number; failed: number };
export type ReencryptFailure = { table: "jwks" | "twoFactor"; id: string; message: string };

export type ReencryptResult = {
  /** 版を使っていない構成では書き換える先が無いので、何もしない。 */
  mode: "single" | "versioned";
  currentVersion: number | null;
  readableVersions: number[];
  jwks: ReencryptCounts;
  twoFactor: ReencryptCounts;
  failures: ReencryptFailure[];
};

function emptyCounts(): ReencryptCounts {
  return { converted: 0, skipped: 0, failed: 0 };
}

/**
 * DB の暗号文を現行版の秘密で暗号化し直す。
 *
 * **これを通さない限り、古い秘密は捨てられない。** Better Auth が版を使うのは
 * 新しく書くときだけで、既に入っている暗号文は古い版のまま残る。とくに TOTP
 * シークレットは利用者が二要素認証を設定し直すまで一生書き換わらない。つまり
 * 版を足しただけでは、古い秘密が漏れたときの被害範囲は縮まっていない。
 *
 * 対象は3つ。ほかにも暗号化される値（メール OTP、OAuth の state）はあるが、
 * どれも数分で消えるので放っておけばよい。
 *
 * 読めない行は**触らずに飛ばす**。読めない行を上書きすると復旧できなくなる。
 */
export async function reencryptSecrets(
  options: { dryRun?: boolean } = {},
): Promise<ReencryptResult> {
  const dryRun = options.dryRun ?? false;
  const secretConfig = resolveSecretConfig();
  const failures: ReencryptFailure[] = [];

  if (typeof secretConfig === "string") {
    return {
      mode: "single",
      currentVersion: null,
      readableVersions: [],
      jwks: emptyCounts(),
      twoFactor: emptyCounts(),
      failures,
    };
  }

  const isCurrent = (raw: string) =>
    parseEnvelope(raw)?.version === secretConfig.currentVersion;

  /** 現行版へ変換した値。書き換え不要なら null。復号できなければ例外。 */
  const convert = async (raw: string): Promise<string | null> => {
    if (isCurrent(raw)) return null;
    const plaintext = await symmetricDecrypt({ key: secretConfig, data: raw });
    return symmetricEncrypt({ key: secretConfig, data: plaintext });
  };

  const jwks = emptyCounts();
  for (const row of await prisma.jwks.findMany({ select: { id: true, privateKey: true } })) {
    // jwks だけ JSON.stringify されて入っている。書き戻すときも同じ形にする。
    const stored: unknown = JSON.parse(row.privateKey);
    if (typeof stored !== "string") {
      jwks.skipped += 1;
      continue;
    }

    try {
      const converted = await convert(stored);
      if (converted === null) {
        jwks.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await prisma.jwks.update({
          where: { id: row.id },
          data: { privateKey: JSON.stringify(converted) },
        });
      }
      jwks.converted += 1;
    } catch (error) {
      jwks.failed += 1;
      failures.push({ table: "jwks", id: row.id, message: (error as Error).message });
    }
  }

  const twoFactor = emptyCounts();
  for (const row of await prisma.twoFactor.findMany({
    select: { id: true, secret: true, backupCodes: true },
  })) {
    try {
      const secret = await convert(row.secret);
      const backupCodes = await convert(row.backupCodes);

      if (secret === null && backupCodes === null) {
        twoFactor.skipped += 1;
        continue;
      }
      if (!dryRun) {
        await prisma.twoFactor.update({
          where: { id: row.id },
          data: {
            ...(secret === null ? {} : { secret }),
            ...(backupCodes === null ? {} : { backupCodes }),
          },
        });
      }
      twoFactor.converted += 1;
    } catch (error) {
      // 飛ばした行は、その利用者が二要素認証を設定し直すまで古い版のまま。
      // 古い版の秘密を捨てると、その人は締め出される。
      twoFactor.failed += 1;
      failures.push({ table: "twoFactor", id: row.id, message: (error as Error).message });
    }
  }

  return {
    mode: "versioned",
    currentVersion: secretConfig.currentVersion,
    readableVersions: [...secretConfig.keys.keys()].sort((a, b) => a - b),
    jwks,
    twoFactor,
    failures,
  };
}
