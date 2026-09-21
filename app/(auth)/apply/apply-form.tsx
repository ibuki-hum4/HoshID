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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { submitApplication } from "./actions";

const schema = z.object({
  name: z.string().min(1, "表示名を入力してください").max(64),
  email: z.email("メールアドレスの形式が正しくありません"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上にしてください")
    .max(128),
});

export function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);

    // 申請はサーバ側で処理する。申請した本人にだけ、この先へ進むための
    // チケットを Cookie で渡すため（app/(auth)/apply/actions.ts）。
    // 既に登録済みのメールアドレスかどうかは、ここでは区別できない作りに
    // なっている。区別できると「誰が HoshID を使っているか」を総当たりで
    // 調べられる。
    const result = await submitApplication(values);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push("/apply/link");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">アカウント申請</CardTitle>
        <CardDescription>
          HoshID のアカウントは申請制です。管理者の承認後に利用できるようになります。
        </CardDescription>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>表示名</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormDescription>
                    承認の結果はこのアドレスに送られます。
                  </FormDescription>
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
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>8文字以上。</FormDescription>
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
              {form.formState.isSubmitting ? "送信しています…" : "申請を送る"}
            </Button>

            <p className="text-muted-foreground text-sm">
              既にアカウントをお持ちの方は{" "}
              <Link
                href={`/sign-in?${searchParams.toString()}`}
                className="text-foreground underline underline-offset-4"
              >
                ログイン
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
