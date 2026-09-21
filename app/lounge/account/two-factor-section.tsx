"use client";

import { Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import QRCode from "qrcode";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Step = "closed" | "password" | "scan" | "backup";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disabling, setDisabling] = useState(false);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep("closed");
    setPassword("");
    setCode("");
    setQr(null);
    setSecret(null);
    setBackupCodes([]);
  }

  async function beginEnable() {
    setMessage(null);

    const { data, error } = await authClient.twoFactor.enable({ password });

    if (error || !data) {
      setMessage({ kind: "error", text: "パスワードが正しくありません。" });
      return;
    }

    // 戻り値は method で分岐する。TOTP の登録情報が返るのは
    // method === "totp" のときだけ。
    if (data.method !== "totp") {
      setMessage({
        kind: "error",
        text: "認証アプリの設定情報を受け取れませんでした。",
      });
      return;
    }

    // totpURI は otpauth:// 形式。認証アプリはこれを読み取る。
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
    setSecret(extractSecret(data.totpURI));
    setBackupCodes(data.backupCodes ?? []);
    setStep("scan");
  }

  async function confirmCode() {
    setMessage(null);

    const { error } = await authClient.twoFactor.verifyTotp({ code });

    if (error) {
      setMessage({ kind: "error", text: "コードが一致しません。もう一度お試しください。" });
      return;
    }

    // ここまで来て初めて有効。バックアップコードを控えてもらう。
    setStep("backup");
  }

  function finish() {
    reset();
    setMessage({ kind: "ok", text: "二段階認証を有効にしました。" });
    startTransition(() => router.refresh());
  }

  async function disable() {
    setMessage(null);

    const { error } = await authClient.twoFactor.disable({ password });

    if (error) {
      setMessage({ kind: "error", text: "パスワードが正しくありません。" });
      return;
    }

    setDisabling(false);
    setPassword("");
    setMessage({ kind: "ok", text: "二段階認証を無効にしました。" });
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              二段階認証
              <Badge
                variant={enabled ? "secondary" : "outline"}
              >
                {enabled ? "有効" : "無効"}
              </Badge>
            </CardTitle>
            <CardDescription>
              ログイン時に、認証アプリのコードかメールで届くコードの入力を求めます。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {message ? (
          <Alert variant={message.kind === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-muted-foreground text-sm">
          {enabled
            ? "認証アプリのコード、メールで届くコード、バックアップコードのいずれかでログインできます。"
            : "有効にすると、パスワードを知られただけではログインされなくなります。"}
        </p>
      </CardContent>

      <CardFooter className="justify-end">
        {enabled ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDisabling(true);
              setPassword("");
              setMessage(null);
            }}
          >
            <ShieldOff className="size-4" aria-hidden />
            無効にする
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setStep("password");
              setPassword("");
              setMessage(null);
            }}
          >
            <ShieldCheck className="size-4" aria-hidden />
            有効にする
          </Button>
        )}
      </CardFooter>

      {/* 有効化: パスワード確認 → QR 読み取り → コード確認 → バックアップコード */}
      <Dialog open={step !== "closed"} onOpenChange={(open) => (open ? null : reset())}>
        <DialogContent>
          {step === "password" ? (
            <>
              <DialogHeader>
                <DialogTitle>二段階認証を有効にする</DialogTitle>
                <DialogDescription>
                  本人確認のため、現在のパスワードを入力してください。
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2">
                <Label htmlFor="tf-password">現在のパスワード</Label>
                <Input
                  id="tf-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <DialogFooter>
                <Button variant="ghost"  onClick={reset}>
                  やめる
                </Button>
                <Button  onClick={beginEnable}>
                  続ける
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "scan" ? (
            <>
              <DialogHeader>
                <DialogTitle>認証アプリに登録</DialogTitle>
                <DialogDescription>
                  認証アプリで QR コードを読み取り、表示された6桁を入力してください。
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {qr ? (
                  // 生成した data URL をそのまま出す。next/image を通す必要はない。
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt="認証アプリ用の QR コード"
                    className="mx-auto rounded-xl bg-white p-2"
                    width={220}
                    height={220}
                  />
                ) : null}

                {secret ? (
                  <div className="grid gap-2">
                    <Label>QR を読み取れない場合はこのキーを入力</Label>
                    <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm break-all">
                      {secret}
                    </code>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="tf-code">認証アプリのコード</Label>
                  <Input
                    id="tf-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost"  onClick={reset}>
                  やめる
                </Button>
                <Button
                  disabled={code.length !== 6}
                  onClick={confirmCode}
                >
                  確認する
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "backup" ? (
            <>
              <DialogHeader>
                <DialogTitle>バックアップコードを控えてください</DialogTitle>
                <DialogDescription>
                  端末もメールも使えなくなったときの最後の手段です。ここでしか表示されません。
                </DialogDescription>
              </DialogHeader>

              <div className="bg-muted grid grid-cols-2 gap-2 rounded-lg p-4 font-mono text-sm">
                {backupCodes.map((backupCode) => (
                  <span key={backupCode}>{backupCode}</span>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(backupCodes.join("\n"))}
              >
                <Copy className="size-4" aria-hidden />
                コピー
              </Button>

              <DialogFooter>
                <Button  onClick={finish}>
                  控えました
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={disabling} onOpenChange={setDisabling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>二段階認証を無効にする</DialogTitle>
            <DialogDescription>
              パスワードだけでログインできる状態に戻ります。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="tf-disable-password">現在のパスワード</Label>
            <Input
              id="tf-disable-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDisabling(false)}
            >
              やめる
            </Button>
            <Button variant="destructive"  onClick={disable}>
              無効にする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** otpauth:// URI から秘密鍵部分を取り出す。QR が読めないときの手入力用。 */
function extractSecret(totpUri: string): string | null {
  try {
    return new URL(totpUri).searchParams.get("secret");
  } catch {
    return null;
  }
}
