"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

const schema = z.object({
  email: z.email("メールアドレスの形式が正しくありません"),
});

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    // 戻り先はリンクを開いた後の画面。トークンはクエリで渡ってくる。
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
    });

    // **成否に関わらず同じ画面を出す。** エラーを出し分けると、そのアドレスが
    // 登録済みかどうかを誰でも確かめられてしまう。送信に失敗した場合も
    // ここでは区別せず、サーバ側のログに残す。
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">メールを送信しました</CardTitle>
          <CardDescription>
            入力されたメールアドレスが登録されている場合、再設定用のリンクを送りました。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            リンクは1時間で無効になります。届かない場合は迷惑メールフォルダを確認してください。
            それでも見つからない場合、そのアドレスでは登録されていない可能性があります。
          </p>
        </CardContent>

        <CardFooter>
          <Button asChild variant="ghost" className="mx-auto">
            <Link href="/sign-in">ログイン画面へ戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">パスワードの再設定</CardTitle>
        <CardDescription>
          登録したメールアドレスに、再設定用のリンクを送ります。
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                再設定すると、ログイン中の他の端末はすべてログアウトされます。
              </AlertDescription>
            </Alert>

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
          </CardContent>

          <CardFooter className="mt-6 flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "送信しています…" : "再設定用のリンクを送る"}
            </Button>

            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">ログイン画面へ戻る</Link>
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
