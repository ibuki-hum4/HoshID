"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

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
      // ここに来るのはパスワード照合を通った後にセッション生成が拒否された
      // 場合、つまり承認されていないアカウント。列挙の材料にはならない。
      router.push("/pending");
      return;
    }

    // 認可フローの途中なら、受け取った署名付きクエリをそのまま返して続行する。
    // クエリを落とすとフローが切れる。
    const authorizeUrl = buildAuthorizeUrl(searchParams);
    if (authorizeUrl) {
      window.location.assign(authorizeUrl);
      return;
    }

    router.push("/");
  }

  return (
    <Card className="rounded-3xl shadow-sm">
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
              className="w-full rounded-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "確認しています…" : "ログイン"}
            </Button>

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
