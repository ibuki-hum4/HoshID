"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";

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

import { sendApplicationVerification } from "../actions";

type Linked = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Discord のサーバに参加しているか。null は未確認。 */
  inGuild: boolean | null;
};

const MESSAGES: Record<string, { tone: "info" | "error"; text: string }> = {
  cancelled: { tone: "info", text: "連携を取りやめました。" },
  taken: {
    tone: "error",
    text: "この Discord アカウントは、別の HoshID アカウントに既に連携されています。",
  },
  error: {
    tone: "error",
    text: "連携できませんでした。時間をおいてもう一度お試しください。",
  },
};

export function ApplicationLinkStep({
  configured,
  purpose,
  linked,
  inviteUrl,
  linkResult,
}: {
  configured: boolean;
  purpose: string;
  linked: Linked[];
  inviteUrl: string | null;
  linkResult: string | null;
}) {
  const hasLinked = linked.length > 0;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  const message = linkResult && linkResult !== "linked" ? MESSAGES[linkResult] : null;

  function next() {
    setSending(true);
    startTransition(async () => {
      // 確認メールはここで送る。画面で「メールを確認してください」と言う
      // 瞬間に届く方が分かりやすい。
      await sendApplicationVerification();
      router.push("/apply/submitted");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Discord と連携</CardTitle>
        <CardDescription>
          申請を受け付けました。続けて、Discord アカウントとの連携をお願いしています。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {message ? (
          <Alert variant={message.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-muted-foreground text-sm leading-relaxed">{purpose}</p>

        {hasLinked ? (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {linked.map((account) => (
              <li key={account.id} className="flex items-center gap-3 p-4">
                <Avatar className="size-10 shrink-0">
                  {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{account.username.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {account.displayName ?? account.username}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    @{account.username}
                  </p>
                </div>
                <Check className="size-4 shrink-0" aria-hidden />
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          サーバにいないとロールが付かない。**繋いだ直後に伝える。**
          承認された後で「ロールが来ない」と悩ませないため。
        */}
        {linked.some((account) => account.inGuild === false) ? (
          <Alert>
            <AlertDescription>
              連携した Discord アカウントは、まだサーバに参加していません。
              参加していないと、承認されてもロールが付きません。
              {inviteUrl ? (
                <>
                  {" "}
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4"
                  >
                    サーバに参加する
                  </a>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {configured ? null : (
          <Alert>
            <AlertDescription>
              いまは Discord 連携を利用できません。このまま次へ進んでください。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="mt-2 flex-col gap-3">
        {configured ? (
          <Button asChild variant={hasLinked ? "outline" : "default"} className="w-full">
            <a href="/api/link/discord/start?returnTo=/apply/link">
              {hasLinked ? "別の Discord アカウントも連携する" : "Discord と連携する"}
            </a>
          </Button>
        ) : null}

        <Button
          variant={hasLinked || !configured ? "default" : "ghost"}
          className="w-full"
          disabled={pending || sending}
          onClick={next}
        >
          {pending || sending
            ? "送信しています…"
            : hasLinked
              ? "次へ（確認メールを送る）"
              : "連携せずに次へ"}
        </Button>

        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          連携は必須ではありませんが、連携がないと審査に時間がかかることがあります。
          あとからアカウントセンターで連携することもできます。
        </p>
      </CardFooter>
    </Card>
  );
}
