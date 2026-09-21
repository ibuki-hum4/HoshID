"use client";

import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

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
import { Switch } from "@/components/ui/switch";

import { createApp } from "./actions";
import { ScopePicker } from "./scope-picker";
import { SecretReveal } from "./secret-reveal";

function Toggle({
  title,
  description,
  note,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{note ?? description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={title}
      />
    </div>
  );
}

export function CreateAppForm() {
  const [clientName, setClientName] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([""]);
  const [scopes, setScopes] = useState<string[]>(["openid", "profile", "email"]);
  const [publicClient, setPublicClient] = useState(false);
  const [requirePkce, setRequirePkce] = useState(true);
  const [clientCredentials, setClientCredentials] = useState(false);
  const [deviceCode, setDeviceCode] = useState(false);
  const [endSession, setEndSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    clientId: string;
    clientSecret: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createApp({
        clientName,
        redirectUris,
        scopes,
        publicClient,
        requirePkce,
        clientCredentials,
        deviceCode,
        endSession,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setCreated({ clientId: result.clientId, clientSecret: result.clientSecret });
      setClientName("");
      setRedirectUris([""]);
      setScopes(["openid", "profile", "email"]);
      setPublicClient(false);
      setRequirePkce(true);
      setClientCredentials(false);
      setDeviceCode(false);
      setEndSession(false);
    });
  }

  return (
    <>
      {created ? (
        <SecretReveal
          clientId={created.clientId}
          clientSecret={created.clientSecret}
          onClose={() => setCreated(null)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">アプリを登録</CardTitle>
          <CardDescription>
            登録するとすぐに使えます。管理者の承認は不要です。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="client-name">
              アプリ名 <span className="text-destructive">*</span>
            </Label>
            <p className="text-muted-foreground text-xs">
              同意画面で利用者に表示されます。
            </p>
            <Input
              id="client-name"
              value={clientName}
              maxLength={80}
              placeholder="例: マイ・ウェブアプリ"
              onChange={(event) => setClientName(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>
              リダイレクト URI <span className="text-destructive">*</span>
            </Label>
            <p className="text-muted-foreground text-xs">
              認証後の戻り先。完全一致で照合されるため、末尾のスラッシュまで正確に。
              公開ホストは https のみ、http は localhost と 127.0.0.1 のみ使えます。
            </p>

            {redirectUris.map((uri, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={uri}
                  inputMode="url"
                  placeholder="https://app.example.com/callback"
                  onChange={(event) =>
                    setRedirectUris((current) =>
                      current.map((v, i) => (i === index ? event.target.value : v)),
                    )
                  }
                />
                {redirectUris.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="この URI を削除"
                    onClick={() =>
                      setRedirectUris((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setRedirectUris((current) => [...current, ""])}
            >
              <Plus className="size-4" aria-hidden />
              URI を追加
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>
              許可スコープ <span className="text-destructive">*</span>
            </Label>
            <ScopePicker value={scopes} onChange={setScopes} disabled={pending} />
            <p className="text-muted-foreground text-xs">
              refresh_token が必要なら offline_access を含めてください。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium">パブリッククライアント</p>
                <p className="text-muted-foreground text-xs">
                  SPA やモバイルなど、シークレットを秘密にできないアプリ向け。
                </p>
              </div>
              <Switch
                checked={publicClient}
                disabled={pending}
                onCheckedChange={setPublicClient}
                aria-label="パブリッククライアント"
              />
            </div>

            <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  PKCE 必須
                </p>
                <p className="text-muted-foreground text-xs">
                  {publicClient
                    ? "パブリッククライアントでは常に必須です。"
                    : "OAuth 2.1 の推奨。PKCE 非対応の古いアプリを繋ぐ場合のみ外してください。"}
                </p>
              </div>
              <Switch
                checked={publicClient ? true : requirePkce}
                disabled={pending || publicClient}
                onCheckedChange={setRequirePkce}
                aria-label="PKCE 必須"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>追加で使う機能</Label>
            <p className="text-muted-foreground text-xs">
              使うものだけを有効にしてください。増やすほど、鍵が漏れたときに
              できることが増えます。
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                title="サーバ間通信"
                description="利用者の同意を挟まずにトークンを取ります。バッチ処理など、人が介在しない用途向け。"
                checked={clientCredentials}
                disabled={pending || publicClient}
                note={
                  publicClient
                    ? "パブリッククライアントでは使えません（秘密を持てないため）。"
                    : undefined
                }
                onChange={setClientCredentials}
              />

              <Toggle
                title="機器からのログイン"
                description="CLI やテレビなど、入力しづらい機器向け。利用者は別の端末でコードを入力します。"
                checked={deviceCode}
                disabled={pending}
                onChange={setDeviceCode}
              />

              <Toggle
                title="アプリからのログアウト"
                description="アプリ側の操作で HoshID のセッションも終了できるようにします。"
                checked={endSession}
                disabled={pending}
                onChange={setEndSession}
              />
            </div>
          </div>

          {!publicClient && !requirePkce ? (
            <Alert variant="destructive">
              <AlertDescription>
                PKCE を外すと、認可コードを横取りされた際の防御が弱くなります。アプリが
                本当に PKCE に対応していない場合だけにしてください。なお offline_access
                を要求する場合は、PKCE か OIDC の nonce のどちらかが必要です。
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end">
          <Button  disabled={pending} onClick={submit}>
            <Plus className="size-4" aria-hidden />
            {pending ? "作成しています…" : "アプリを登録して認証情報を受け取る"}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
