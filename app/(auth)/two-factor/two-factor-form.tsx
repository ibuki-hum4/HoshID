"use client";

import { KeyRound, Mail, Smartphone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { buildAuthorizeUrl } from "@/lib/oauth-flow";

type Method = "totp" | "email" | "backup";

export function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [method, setMethod] = useState<Method>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function finish() {
    // ログイン画面と同じく、認可フローの途中なら署名付きクエリを
    // そのまま返して続行する。
    const authorizeUrl = buildAuthorizeUrl(searchParams);
    if (authorizeUrl) {
      window.location.assign(authorizeUrl);
      return;
    }
    router.push("/lounge");
  }

  async function sendEmailCode() {
    setError(null);
    setPending(true);

    try {
      const { error: sendError } = await authClient.twoFactor.sendOtp();
      if (sendError) {
        setError("コードを送信できませんでした。しばらくしてからお試しください。");
        return;
      }
      setEmailSent(true);
      setMethod("email");
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    setError(null);
    setPending(true);

    try {
      const result =
        method === "totp"
          ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
          : method === "email"
            ? await authClient.twoFactor.verifyOtp({ code, trustDevice })
            : await authClient.twoFactor.verifyBackupCode({ code, trustDevice });

      if (result?.error) {
        setError("コードが一致しません。もう一度お試しください。");
        return;
      }

      finish();
    } finally {
      setPending(false);
    }
  }

  const label =
    method === "totp"
      ? "認証アプリのコード"
      : method === "email"
        ? "メールに届いたコード"
        : "バックアップコード";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">確認コードの入力</CardTitle>
        <CardDescription>
          {method === "backup"
            ? "控えておいたバックアップコードを入力してください。"
            : method === "email"
              ? emailSent
                ? "登録のメールアドレスにコードを送りました。"
                : "メールでコードを受け取ります。"
              : "認証アプリに表示されている6桁を入力してください。"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="tf-code">{label}</Label>
          <Input
            id="tf-code"
            inputMode={method === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            maxLength={method === "backup" ? 32 : 6}
            placeholder={method === "backup" ? "xxxxx-xxxxx" : "123456"}
            value={code}
            onChange={(event) =>
              setCode(
                method === "backup"
                  ? event.target.value.trim()
                  : event.target.value.replace(/\D/g, ""),
              )
            }
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          この端末を信頼する（しばらく確認を省略）
        </label>

        <Separator />

        <div className="flex flex-wrap gap-2">
          {method !== "totp" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setMethod("totp");
                setCode("");
                setError(null);
              }}
            >
              <Smartphone className="size-4" aria-hidden />
              認証アプリを使う
            </Button>
          ) : null}

          {method !== "email" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={sendEmailCode}
            >
              <Mail className="size-4" aria-hidden />
              メールでコードを受け取る
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={sendEmailCode}
            >
              <Mail className="size-4" aria-hidden />
              コードを再送する
            </Button>
          )}

          {method !== "backup" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setMethod("backup");
                setCode("");
                setError(null);
              }}
            >
              <KeyRound className="size-4" aria-hidden />
              バックアップコードを使う
            </Button>
          ) : null}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={pending || code.length === 0}
          onClick={verify}
        >
          {pending ? "確認しています…" : "コードを確認してログイン"}
        </Button>
      </CardFooter>
    </Card>
  );
}
