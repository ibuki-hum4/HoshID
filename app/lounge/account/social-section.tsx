"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  SOCIAL_PROVIDER_META,
  type SocialLinkView,
  type SocialProvider,
} from "@/lib/social-providers";

import { setShowContributions, unlinkSocial } from "./actions";

const MESSAGES: Record<string, { tone: "info" | "error"; text: string }> = {
  linked: { tone: "info", text: "連携しました。" },
  cancelled: { tone: "info", text: "連携を取りやめました。" },
  taken: {
    tone: "error",
    text: "そのアカウントは、別の HoshID アカウントに既に連携されています。",
  },
  error: {
    tone: "error",
    text: "連携できませんでした。時間をおいてもう一度お試しください。",
  },
};

export function SocialSection({
  links,
  available,
  linkResult,
}: {
  links: SocialLinkView[];
  /** 資格情報が設定済みのサービス。未設定のものはボタンを出さない。 */
  available: SocialProvider[];
  linkResult: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(linkResult ? MESSAGES[linkResult] : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>外部アカウント</CardTitle>
        <CardDescription>
          Discord と GitHub のアカウントを連携できます。連携は本人確認と、プロフィールの
          表示に使われます。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {message ? (
          <Alert variant={message.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        {(Object.keys(SOCIAL_PROVIDER_META) as SocialProvider[]).map((provider) => {
          const meta = SOCIAL_PROVIDER_META[provider];
          const mine = links.filter((link) => link.provider === provider);
          const configured = available.includes(provider);
          // 複数繋げるサービスは常に追加できる。1つだけのものは、繋いでいない
          // ときだけボタンを出す（繋ぎ直しは一度外してから）。
          const canAdd = configured && (meta.allowsMultiple || mine.length === 0);

          return (
            <section key={provider} className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{meta.label}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {meta.purpose}
                  </p>
                </div>

                {canAdd ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <a href={`/api/link/${provider}/start?returnTo=/lounge/account`}>
                      <Plus className="size-4" aria-hidden />
                      連携する
                    </a>
                  </Button>
                ) : null}
              </div>

              {configured ? null : (
                <p className="text-muted-foreground text-xs">
                  いまこのサービスとの連携は利用できません。
                </p>
              )}

              {mine.length === 0 ? (
                <p className="text-muted-foreground text-sm">連携していません。</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-lg border">
                  {mine.map((link) => (
                    <li key={link.id} className="space-y-3 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 shrink-0">
                          {link.avatarUrl ? <AvatarImage src={link.avatarUrl} alt="" /> : null}
                          <AvatarFallback>{link.username.slice(0, 1)}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {link.displayName ?? link.username}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            @{link.username}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            setMessage(null);
                            startTransition(async () => {
                              await unlinkSocial(link.id);
                            });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">連携を解除</span>
                        </Button>
                      </div>

                      {link.inGuild === false ? (
                        <p className="text-muted-foreground border-t pt-3 text-xs leading-relaxed">
                          このアカウントは Discord のサーバに参加していないため、
                          ロールが付きません。サーバに参加すると、次回の同期で付きます。
                        </p>
                      ) : null}

                      {provider === "github" ? (
                        <div className="flex items-center justify-between gap-4 border-t pt-3">
                          <div className="min-w-0">
                            <p className="text-sm">草をプロフィールに表示する</p>
                            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                              直近1年の公開コントリビューションを、メンバー名簿の
                              プロフィールに出します。
                            </p>
                          </div>
                          <Switch
                            checked={link.showContributions}
                            disabled={pending}
                            onCheckedChange={(checked) => {
                              setMessage(null);
                              startTransition(async () => {
                                await setShowContributions(link.id, checked);
                              });
                            }}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
