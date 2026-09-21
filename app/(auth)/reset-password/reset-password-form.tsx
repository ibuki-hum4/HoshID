"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

const schema = z
  .object({
    password: z
      .string()
      .min(8, "パスワードは8文字以上にしてください")
      .max(128),
    confirm: z.string(),
  })
  // 打ち間違えたまま確定すると、本人が締め出される。ここだけは2回入力させる。
  .refine((values) => values.password === values.confirm, {
    message: "パスワードが一致しません",
    path: ["confirm"],
  });

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // メールのリンクを開くと、Better Auth がトークンを検証してここへ戻す。
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);

    if (!token) {
      setError("リンクが正しくありません。もう一度やり直してください。");
      return;
    }

    const { error: resetError } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });

    if (resetError) {
      // 期限切れか、既に使われたトークン。どちらも同じ案内でよい。
      setError(
        "パスワードを再設定できませんでした。リンクの有効期限が切れているか、既に使われています。",
      );
      return;
    }

    setDone(true);
  }

  // リンクが無効なときは、フォームを出さずに理由を伝える。入力させてから
  // 失敗させるのは無駄に手を動かさせることになる。
  if (linkError || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">リンクが使えません</CardTitle>
          <CardDescription>
            有効期限が切れているか、既に使われたリンクです。
          </CardDescription>
        </CardHeader>

        <CardFooter>
          <Button asChild className="mx-auto">
            <Link href="/forgot-password">もう一度やり直す</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">パスワードを変更しました</CardTitle>
          <CardDescription>
            新しいパスワードでログインできます。他の端末はログアウトされました。
          </CardDescription>
        </CardHeader>

        <CardFooter>
          <Button className="mx-auto" onClick={() => router.push("/sign-in")}>
            ログイン画面へ
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">新しいパスワード</CardTitle>
        <CardDescription>新しいパスワードを設定します。</CardDescription>
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新しいパスワード</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>確認のためもう一度</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "変更しています…" : "パスワードを変更する"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
