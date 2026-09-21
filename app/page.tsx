import Link from "next/link";
import { AppWindow, Fingerprint, ShieldCheck, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canSignIn } from "@/lib/account-status";
import { getCurrentSession } from "@/lib/session";

export default async function Home() {
  // ログイン済みならラウンジへ誘導する。毎回同じ説明を読ませない。
  const session = await getCurrentSession().catch(() => null);
  const signedIn = Boolean(
    session && canSignIn((session.user as { status?: string }).status),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <section>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.08em]">
          HoshID
        </p>
        {/*
          **言い回しで持ち上げない。** 何であって、何ができるかだけを書く。
          肩書きのような一文を置くと、読む人はまず「で、これは何なのか」を
          探すことになる。
        */}
        <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">
          OpenID Connect プロバイダ
        </h1>
        <p className="text-muted-foreground mt-4 max-w-prose leading-relaxed">
          対応したサービスに、HoshID のアカウントでログインできます。
          パスワードを預けるのは HoshID だけで、連携先には渡りません。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <Button asChild size="lg">
              <Link href="/lounge">ラウンジへ</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/sign-in">ログイン</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/apply">アカウントを申請</Link>
              </Button>
            </>
          )}
        </div>

        {signedIn ? null : (
          <p className="text-muted-foreground mt-4 text-sm">
            アカウントは申請制です。申請後、管理者が承認すると使えるようになります。
          </p>
        )}
      </section>

      <section className="mt-16 space-y-4">
        <h2>できること</h2>

        <ul className="grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;

            return (
              <li key={feature.title} className="glass-soft p-5">
                <Icon className="text-muted-foreground size-5" aria-hidden />
                <p className="mt-3 text-sm font-medium">{feature.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-16 space-y-4">
        <h2>開発者の方へ</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          自分のアプリを HoshID に繋げられます。OpenID Connect に対応していれば、
          Discovery からエンドポイントを取得できます。
        </p>
        <div className="glass-soft rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">issuer</p>
          <code className="mt-1 block font-mono text-sm break-all">
            {issuer()}
          </code>
        </div>
      </section>
    </main>
  );
}

const FEATURES = [
  {
    icon: UserCheck,
    title: "ひとつのアカウント",
    description:
      "対応したサービスに、同じアカウントでログインできます。サービスごとにパスワードを覚える必要はありません。",
  },
  {
    icon: Fingerprint,
    title: "パスキーと二段階認証",
    description:
      "端末の生体認証でログインしたり、認証アプリのコードを追加したりできます。パスワードだけに頼りません。",
  },
  {
    icon: AppWindow,
    title: "連携の管理",
    description:
      "どのアプリに何を許可したかを一覧でき、いつでも取り消せます。",
  },
  {
    icon: ShieldCheck,
    title: "許可する内容が見える",
    description:
      "アプリに渡る情報は同意画面で確認できます。不要な項目は外して許可できます。",
  },
];

function issuer(): string {
  const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/api/auth`;
}
