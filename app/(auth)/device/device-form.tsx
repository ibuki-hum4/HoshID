"use client";

import { CheckCircle2, MonitorSmartphone, ShieldAlert } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";

type Step = "input" | "confirm" | "approved" | "denied";

/**
 * 機器に表示されたコードを入力して、その機器にアクセスを許可する画面。
 *
 * 利用者が「いま自分が操作している機器」と「許可しようとしている機器」を
 * 取り違えないよう、必ず確認の段を挟む。コードを入れた瞬間に許可すると、
 * 攻撃者が読み上げたコードをそのまま入力させる手口が通ってしまう。
 */
export function DeviceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 機器が user_code 付きの URL を出すこともある（verification_uri_complete）。
  const [code, setCode] = useState(searchParams.get("user_code") ?? "");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function normalize(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  }

  async function submit() {
    setError(null);
    setPending(true);

    try {
      const { error: lookupError } = await authClient.device({
        query: { user_code: code },
      });

      if (lookupError) {
        setError(
          "コードが確認できませんでした。機器に表示されているものと同じか、期限が切れていないか確かめてください。",
        );
        return;
      }

      setStep("confirm");
    } finally {
      setPending(false);
    }
  }

  async function decide(approve: boolean) {
    setError(null);
    setPending(true);

    try {
      const result = approve
        ? await authClient.device.approve({ userCode: code })
        : await authClient.device.deny({ userCode: code });

      if (result?.error) {
        setError("処理できませんでした。もう一度お試しください。");
        return;
      }

      setStep(approve ? "approved" : "denied");
    } finally {
      setPending(false);
    }
  }

  if (step === "approved") {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" aria-hidden />
          </div>
          <CardTitle className="mt-4 text-2xl">機器を許可しました</CardTitle>
          <CardDescription>
            機器の画面に戻ってください。まもなくログインが完了します。
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="ghost"
            className="mx-auto"
            onClick={() => router.push("/lounge")}
          >
            HoshID に戻る
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "denied") {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <ShieldAlert className="size-6" aria-hidden />
          </div>
          <CardTitle className="mt-4 text-2xl">許可しませんでした</CardTitle>
          <CardDescription>
            この機器はあなたのアカウントにアクセスできません。
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="ghost"
            className="mx-auto"
            onClick={() => router.push("/lounge")}
          >
            HoshID に戻る
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {step === "confirm" ? "この機器を許可しますか" : "機器の確認"}
        </CardTitle>
        <CardDescription>
          {step === "confirm"
            ? "許可すると、この機器はあなたとして HoshID にログインできるようになります。"
            : "機器の画面に表示されているコードを入力してください。"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "input" ? (
          <div className="grid gap-2">
            <Label htmlFor="user-code">コード</Label>
            <Input
              id="user-code"
              value={code}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="text-center font-mono text-lg tracking-widest"
              onChange={(event) => setCode(normalize(event.target.value))}
            />
          </div>
        ) : (
          <>
            <div className="glass-soft flex items-center gap-3 rounded-lg border p-4">
              <MonitorSmartphone className="size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-mono text-lg tracking-widest">{code}</p>
                <p className="text-muted-foreground text-xs">
                  機器に表示されているコード
                </p>
              </div>
            </div>

            <Alert variant="destructive">
              <ShieldAlert className="size-4" aria-hidden />
              <AlertDescription>
                このコードを誰かに教えられて入力した場合は、許可しないでください。
                その相手があなたのアカウントを使えるようになります。
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        {step === "input" ? (
          <Button
            className="w-full"
            disabled={pending || code.length < 4}
            onClick={submit}
          >
            {pending ? "確認しています…" : "コードを確認する"}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={pending}
              onClick={() => decide(false)}
            >
              許可しない
            </Button>
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => decide(true)}
            >
              この機器を許可する
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
