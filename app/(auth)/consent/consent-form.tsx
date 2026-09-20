"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { describeScope, isKnownScope, parseScopes } from "@/lib/scopes";

type PublicClient = {
  client_id: string;
  client_name?: string | null;
  logo_uri?: string | null;
  client_uri?: string | null;
};

type RedirectResult = { redirect: true; url: string };

export function ConsentForm() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");
  const requestedScopes = parseScopes(searchParams.get("scope"));

  const [client, setClient] = useState<PublicClient | null>(null);
  const [granted, setGranted] = useState<string[]>(requestedScopes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    fetch(
      `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
      { credentials: "include" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PublicClient | null) => {
        if (!cancelled && data) setClient(data);
      })
      .catch(() => {
        // クライアント名が取れなくても同意自体は続行できる。client_id を出す。
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function toggleScope(scope: string, checked: boolean) {
    setGranted((current) =>
      checked ? [...new Set([...current, scope])] : current.filter((s) => s !== scope),
    );
  }

  async function submit(accept: boolean) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accept,
          // 実際に許可されたスコープだけを返す。要求されたものをそのまま
          // 返すと、ユーザーが外したはずの権限が付与されてしまう。
          scope: accept ? granted.join(" ") : undefined,
          // 署名付きクエリを一切変えずに返す。変えると署名検証に失敗する。
          oauth_query: searchParams.toString(),
        }),
      });

      const result = (await response.json()) as RedirectResult | { message?: string };

      if ("redirect" in result && result.redirect) {
        window.location.assign(result.url);
        return;
      }

      setError("処理できませんでした。最初からやり直してください。");
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = client?.client_name ?? clientId ?? "不明なアプリ";
  const hasUnknownScope = requestedScopes.some((scope) => !isKnownScope(scope));

  if (!clientId) {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">リクエストが不正です</CardTitle>
          <CardDescription>
            アクセス元のアプリが分かりませんでした。アプリ側からやり直してください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="text-center">
        <Avatar className="mx-auto size-12">
          {client?.logo_uri ? (
            <AvatarImage src={client.logo_uri} alt="" />
          ) : null}
          <AvatarFallback>
            <ShieldCheck className="size-6" aria-hidden />
          </AvatarFallback>
        </Avatar>

        <CardTitle className="mt-4 text-2xl">{displayName}</CardTitle>
        <CardDescription>
          このアプリがあなたの HoshID アカウントへのアクセスを求めています。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {hasUnknownScope ? (
          <Alert variant="destructive">
            <AlertDescription>
              このアプリは内容の分からない権限を求めています。心当たりがなければ許可しないでください。
            </AlertDescription>
          </Alert>
        ) : null}

        <ul className="space-y-3">
          {requestedScopes.map((scope) => {
            const description = describeScope(scope);
            const locked = description.required === true;

            return (
              <li key={scope} className="flex gap-3">
                <Checkbox
                  id={`scope-${scope}`}
                  checked={granted.includes(scope)}
                  disabled={locked || submitting}
                  onCheckedChange={(checked) =>
                    toggleScope(scope, checked === true)
                  }
                  className="mt-1"
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor={`scope-${scope}`}
                    className="text-sm leading-none font-medium"
                  >
                    {description.title}
                    {locked ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        必須
                      </span>
                    ) : null}
                  </label>
                  <p className="text-muted-foreground text-sm">
                    {description.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <Separator className="my-6" />

      <CardFooter className="justify-end gap-2">
        <Button
          variant="ghost"
          className="rounded-full"
          disabled={submitting}
          onClick={() => submit(false)}
        >
          拒否
        </Button>
        <Button
          className="rounded-full"
          disabled={submitting}
          onClick={() => submit(true)}
        >
          {submitting ? "処理しています…" : "許可"}
        </Button>
      </CardFooter>
    </Card>
  );
}
