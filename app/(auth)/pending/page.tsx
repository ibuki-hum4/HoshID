import Link from "next/link";
import { Ban, Clock, CircleSlash, PauseCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ACCOUNT_STATUS, isAccountStatus, type AccountStatus } from "@/lib/account-status";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const metadata = { title: "アカウントをご利用いただけません" };

/**
 * ログインできないアカウントの案内。
 *
 * **状態が分かるときだけ、具体的に書く。**
 *
 * ここに来る経路は2つある。ひとつは、承認後に停止されたなどで既存の
 * セッションが残っている場合（`requireApprovedUser` が飛ばす）。このときは
 * 本人のセッションがあるので、本人の状態を読んで具体的に説明してよい。
 *
 * もうひとつはセッションが無い場合で、そのときは何も断定しない。ログイン
 * 画面から状態を確定することはできず（未承認もサーバ障害も同じ経路を通る）、
 * 断定すると、ただの障害を仕様だと誤認させることになる。
 */

type Presentation = {
  icon: LucideIcon;
  title: string;
  description: string;
  body: string;
};

const BY_STATUS: Record<Exclude<AccountStatus, "active">, Presentation> = {
  [ACCOUNT_STATUS.prepared]: {
    icon: Clock,
    title: "承認をお待ちください",
    description: "申請は届いています。管理者の承認をお待ちください。",
    body: "承認されるとメールでお知らせします。しばらく経っても届かない場合は、迷惑メールフォルダを確認のうえ管理者にお問い合わせください。",
  },
  [ACCOUNT_STATUS.rejected]: {
    icon: CircleSlash,
    title: "申請は承認されませんでした",
    description: "このアカウントではログインできません。",
    body: "判断に心当たりがない場合や、状況が変わった場合は管理者にお問い合わせください。",
  },
  [ACCOUNT_STATUS.archived]: {
    icon: PauseCircle,
    title: "アカウントは停止されています",
    description: "使われなくなったため停止されています。",
    body: "再び利用したい場合は管理者にお問い合わせください。アカウントの情報は残っています。",
  },
  [ACCOUNT_STATUS.suspended]: {
    icon: Ban,
    title: "アカウントは停止されています",
    description: "このアカウントの利用は停止されています。",
    body: "理由の確認や再開の相談は、管理者にお問い合わせください。",
  },
};

const UNKNOWN: Presentation = {
  icon: Clock,
  title: "まだご利用いただけません",
  description: "このアカウントは管理者の承認待ち、または承認されませんでした。",
  body: "承認されるとメールでお知らせします。お心当たりがない場合は管理者にお問い合わせください。",
};

export default async function PendingPage() {
  const presentation = await resolvePresentation();
  const Icon = presentation.state.icon;

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </div>
        <CardTitle className="mt-4 text-2xl">{presentation.state.title}</CardTitle>
        <CardDescription>{presentation.state.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {presentation.state.body}
        </p>

        {presentation.note ? (
          <div className="bg-muted/40 rounded-md border p-4 text-left">
            <p className="text-xs font-medium">管理者からの連絡</p>
            <p className="text-muted-foreground mt-1 text-sm break-words whitespace-pre-wrap">
              {presentation.note}
            </p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button asChild variant="ghost" className="mx-auto">
          <Link href="/sign-in">ログイン画面へ戻る</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="mx-auto">
          <Link href="/help/report">お問い合わせ</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

async function resolvePresentation(): Promise<{
  state: Presentation;
  note: string | null;
}> {
  const session = await getCurrentSession().catch(() => null);
  const userId = session?.user?.id;

  if (!userId) {
    return { state: UNKNOWN, note: null };
  }

  // セッションに載っている値ではなく DB を見る。停止はセッションが残ったまま
  // 起きるので、その場で最新の状態を読む必要がある。
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { status: true, reviewNote: true } })
    .catch(() => null);

  if (!user || !isAccountStatus(user.status) || user.status === ACCOUNT_STATUS.active) {
    return { state: UNKNOWN, note: null };
  }

  return {
    state: BY_STATUS[user.status],
    // 却下の理由は本人に宛てて書かれたもの。却下のときだけ出す。
    note: user.status === ACCOUNT_STATUS.rejected ? user.reviewNote : null,
  };
}
