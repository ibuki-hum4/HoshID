import { AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/authorize";
import { JWKS_GRACE_PERIOD_SECONDS, JWKS_ROTATION_INTERVAL_SECONDS } from "@/lib/jwks";
import { inspectKeys, type KeyHealth } from "@/lib/key-health";
import type { JwkState } from "@/lib/jwks";

export const metadata = { title: "署名鍵" };

const STATE: Record<JwkState, { label: string; description: string }> = {
  signing: {
    label: "署名中",
    description: "いま発行されるトークンはこの鍵で署名されます。",
  },
  grace: {
    label: "検証のみ",
    description: "署名には使われませんが、発行済みトークンの検証のため JWKS に残っています。",
  },
  retired: {
    label: "公開終了",
    description: "JWKS から外れました。行は残っていますが、消して構いません。",
  },
};

const days = (seconds: number) => Math.round(seconds / 86_400);

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString("ja-JP") : "—";
}

export default async function KeysPage() {
  // 鍵の状態は、その気になれば攻撃の下調べに使える。管理者だけに見せる。
  await requirePermission({ user: ["set-role"] });

  const health = await inspectKeys();
  const signing = health.keys.find((key) => key.state === "signing");

  return (
    <div className="space-y-8">
      <div>
        <h1>署名鍵</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ID トークンとアクセストークンに署名する鍵です。{days(JWKS_ROTATION_INTERVAL_SECONDS)}
          日ごとに自動で入れ替わり、退役後
          {days(JWKS_GRACE_PERIOD_SECONDS)}日は検証のため公開され続けます。
        </p>
      </div>

      {health.issues.length > 0 ? (
        <ul className="space-y-px overflow-hidden rounded-lg border">
          {health.issues.map((issue) => {
            const Icon = issue.level === "warn" ? AlertTriangle : Info;

            return (
              <li key={issue.code} className="glass-soft flex gap-3 p-4">
                <Icon
                  className={
                    issue.level === "warn"
                      ? "text-foreground mt-0.5 size-4 shrink-0"
                      : "text-muted-foreground mt-0.5 size-4 shrink-0"
                  }
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{issue.summary}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{issue.action}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground glass-soft rounded-lg border p-4 text-sm">
          対処が必要なことはありません。
        </p>
      )}

      <section className="space-y-3">
        <h2>鍵</h2>

        <div className="glass-soft overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>kid</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="whitespace-nowrap">署名の期限</TableHead>
                <TableHead className="whitespace-nowrap">公開の期限</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {health.keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    鍵はまだありません。最初のトークン発行時に作られます。
                  </TableCell>
                </TableRow>
              ) : null}

              {health.keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="max-w-[16rem]">
                    <p className="truncate font-mono text-xs">{key.id}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {key.alg ?? "方式未記録"}
                      {key.crv ? ` / ${key.crv}` : ""} ・ 作成 {formatDate(key.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.state === "signing" ? "default" : "secondary"}>
                      {STATE[key.state].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(key.expiresAt)}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(key.publishedUntil)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {signing ? (
          <p className="text-muted-foreground text-sm">{STATE.signing.description}</p>
        ) : null}
      </section>

      <SecretSection health={health} />

      <section className="space-y-3">
        <h2>操作</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          鍵の操作は画面からは行えません。取り返しのつかない操作（漏洩時の失効）を
          誤って押せる場所に置かないためです。手順は{" "}
          <code className="font-mono text-xs">docs/key-rotation.md</code> にあります。
        </p>

        <dl className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          {COMMANDS.map((command) => (
            <div key={command.command} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
              <dt className="font-mono text-xs whitespace-nowrap sm:w-64">{command.command}</dt>
              <dd className="text-muted-foreground">{command.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function SecretSection({ health }: { health: KeyHealth }) {
  const { secrets } = health;

  return (
    <section className="space-y-3">
      <h2>ルート秘密</h2>
      <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
        署名鍵の秘密鍵、二要素認証の設定を暗号化している値です。
        <strong className="text-foreground font-medium">
          定期的に入れ替えるものではありません。
        </strong>
        版を足しても既存の暗号文は書き換わらないため、入れ替えは再暗号化まで
        終えて初めて意味を持ちます。
      </p>

      <dl className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
        <div className="flex justify-between gap-4 p-4">
          <dt className="text-muted-foreground">構成</dt>
          <dd>
            {secrets.mode === "versioned"
              ? `版 ${secrets.currentVersion} が現行（読める版: ${secrets.knownVersions.join(", ")}）`
              : "BETTER_AUTH_SECRET のみ（版を使っていません）"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 p-4">
          <dt className="text-muted-foreground">暗号文</dt>
          <dd>{secrets.ciphertexts.total} 件</dd>
        </div>
        {secrets.mode === "versioned" ? (
          <>
            <div className="flex justify-between gap-4 p-4">
              <dt className="text-muted-foreground">古い版のまま</dt>
              <dd>{secrets.ciphertexts.stale} 件</dd>
            </div>
            <div className="flex justify-between gap-4 p-4">
              <dt className="text-muted-foreground">版なし（旧形式）</dt>
              <dd>{secrets.ciphertexts.unversioned} 件</dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  );
}

const COMMANDS = [
  {
    command: "bun run keys:maintain",
    description:
      "デプロイのたびに自動で走る保守処理。期限の設定・再暗号化・古い行の削除をまとめて行う。手で叩く必要はない。",
  },
  {
    command: "bun run jwks",
    description: "この画面と同じ内容を端末で表示する。何も変更しない。",
  },
  {
    command: "bun run jwks --rotate",
    description: "予定を待たずに次の鍵へ切り替える。発行済みトークンは壊れない。",
  },
  {
    command: "bun run jwks --revoke <kid>",
    description:
      "鍵を即座に JWKS から削除する。漏洩したときだけ。その鍵で署名されたトークンは全て検証できなくなる。",
  },
  {
    command: "bun run secrets:reencrypt --dry",
    description: "ルート秘密の版を入れ替えるとき、何が書き換わるかを先に確認する。",
  },
];
