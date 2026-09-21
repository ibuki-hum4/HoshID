"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Fingerprint } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { buildAuthorizeUrl } from "@/lib/oauth-flow";

const schema = z.object({
  email: z.email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  /** ログイン成功後の行き先。認可フローの途中ならそこへ戻す。 */
  function goAfterSignIn() {
    const authorizeUrl = buildAuthorizeUrl(searchParams);
    if (authorizeUrl) {
      window.location.assign(authorizeUrl);
      return;
    }
    router.push("/lounge");
  }

  async function signInWithPasskey() {
    setError(null);
    setPasskeyPending(true);

    try {
      const result = await authClient.signIn.passkey();

      if (result?.error) {
        // 未承認アカウントでもここに来る。パスワードのときと同じく
        // 原因を断定しない。
        setError(
          "パスキーでログインできませんでした。登録済みのパスキーが無いか、アカウントがまだ承認されていない可能性があります。",
        );
        return;
      }

      goAfterSignIn();
    } finally {
      setPasskeyPending(false);
    }
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      // 資格情報が誤っている場合は、アカウントの存在を漏らさないよう
      // 常に同じ文言にする。
      if (signInError.code === "INVALID_EMAIL_OR_PASSWORD") {
        setError("メールアドレスまたはパスワードが正しくありません。");
        return;
      }

      // メール未確認は、パスワードが合っていたときにしか返らない。
      // アカウントの存在を漏らさないので、原因を具体的に出してよい。
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        setError(
          "メールアドレスがまだ確認されていません。確認用のメールを送り直しました。受信箱をご確認ください。",
        );
        return;
      }

      // それ以外は原因を確定できない。未承認アカウントはセッション生成が
      // 拒否されてここに来るが、サーバ側の障害でも同じ経路を通る。
      // 「承認待ち」と断定して /pending に飛ばすと、ただの障害を仕様だと
      // 誤認させてしまうので、両方の可能性を示すに留める。
      setError(
        "ログインできませんでした。アカウントがまだ承認されていないか、一時的な問題が起きています。",
      );
      return;
    }

    // 認可フローの途中なら、受け取った署名付きクエリをそのまま返して続行する。
    // クエリを落とすとフローが切れる。
    goAfterSignIn();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">ログイン</CardTitle>
        <CardDescription>HoshID のアカウントでログインします。</CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="username"
                      placeholder="you@example.jp"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>パスワード</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6 flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || passkeyPending}
            >
              {form.formState.isSubmitting ? "確認しています…" : "ログインする"}
            </Button>

            <div className="flex w-full items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">または</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={form.formState.isSubmitting || passkeyPending}
              onClick={signInWithPasskey}
            >
              <Fingerprint className="size-4" aria-hidden />
              {passkeyPending ? "確認しています…" : "パスキーでログイン"}
            </Button>

            <p className="text-muted-foreground text-sm">
              <Link
                href="/forgot-password"
                className="text-foreground underline underline-offset-4"
              >
                パスワードをお忘れですか
              </Link>
            </p>

            <p className="text-muted-foreground text-sm">
              アカウントをお持ちでない方は{" "}
              <Link
                href={`/apply?${searchParams.toString()}`}
                className="text-foreground underline underline-offset-4"
              >
                アカウントを申請
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
