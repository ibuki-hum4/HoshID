"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { describeScope, isKnownScope, parseScopes } from "@/lib/scopes";

export type ConsentClient = {
  clientId: string;
  name: string | null;
  logoUri: string | null;
  clientUri: string | null;
  redirectHosts: string[];
  ownerName: string | null;
  verified: boolean;
  registeredAt: string | null;
  firstTime: boolean;
};

type RedirectResult = { redirect: true; url: string };

export function ConsentForm({ client }: { client: ConsentClient | null }) {
  const searchParams = useSearchParams();
  const requestedScopes = parseScopes(searchParams.get("scope"));

  const [granted, setGranted] = useState<string[]>(requestedScopes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleScope(scope: string, checked: boolean) {
    setGranted((current) =>
      checked
        ? [...new Set([...current, scope])]
        : current.filter((s) => s !== scope),
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

  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">リクエストが不正です</CardTitle>
          <CardDescription>
            アクセス元のアプリが分かりませんでした。アプリ側からやり直してください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayName = client.name ?? client.clientId;
  const hasUnknownScope = requestedScopes.some((scope) => !isKnownScope(scope));

  return (
    <Card>
      <CardHeader className="text-center">
        <Avatar className="mx-auto size-12">
          {client.logoUri ? <AvatarImage src={client.logoUri} alt="" /> : null}
          <AvatarFallback>
            <ShieldCheck className="size-6" aria-hidden />
          </AvatarFallback>
        </Avatar>

        <CardTitle className="mt-4 flex flex-wrap items-center justify-center gap-2 text-2xl">
          {displayName}
          {client.verified ? (
            <Badge variant="secondary" className="gap-1 rounded-full">
              <BadgeCheck className="size-3.5" aria-hidden />
              検証済み
            </Badge>
          ) : null}
        </CardTitle>

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

        {/*
          アプリ名は登録者が自由に付けられる。検証していないものは
          「HoshID 公式」等を名乗れてしまうため、必ず未検証であることを示す。
        */}
        {client.verified ? null : (
          <Alert variant="destructive">
            <ShieldAlert className="size-4" aria-hidden />
            <AlertDescription>
              このアプリは HoshID が検証していません。アプリ名は登録者が自由に付けた
              ものです。心当たりのないアプリには許可しないでください。
            </AlertDescription>
          </Alert>
        )}

        {client.firstTime ? (
          <p className="text-muted-foreground text-sm">
            このアプリに許可を与えるのは初めてです。
          </p>
        ) : null}

        <dl className="bg-muted/40 space-y-2 rounded-lg p-4 text-sm">
          <div className="flex gap-3">
            <dt className="text-muted-foreground w-24 shrink-0">送信先</dt>
            <dd className="min-w-0 break-all">
              {client.redirectHosts.length > 0
                ? client.redirectHosts.join(", ")
                : "不明"}
            </dd>
          </div>

          <div className="flex gap-3">
            <dt className="text-muted-foreground w-24 shrink-0">登録者</dt>
            <dd className="min-w-0 break-all">{client.ownerName ?? "不明"}</dd>
          </div>

          {client.registeredAt ? (
            <div className="flex gap-3">
              <dt className="text-muted-foreground w-24 shrink-0">登録日</dt>
              <dd>{new Date(client.registeredAt).toLocaleDateString("ja-JP")}</dd>
            </div>
          ) : null}

          {client.clientUri ? (
            <div className="flex gap-3">
              <dt className="text-muted-foreground w-24 shrink-0">サイト</dt>
              <dd className="min-w-0">
                <a
                  href={client.clientUri}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center gap-1 break-all underline underline-offset-4"
                >
                  {client.clientUri}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

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
                  onCheckedChange={(checked) => toggleScope(scope, checked === true)}
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
                  <p className="text-muted-foreground text-sm">{description.detail}</p>
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
          disabled={submitting}
          onClick={() => submit(false)}
        >
          拒否
        </Button>
        <Button
          disabled={submitting}
          onClick={() => submit(true)}
        >
          {submitting ? "処理しています…" : "許可"}
        </Button>
      </CardFooter>
    </Card>
  );
}
