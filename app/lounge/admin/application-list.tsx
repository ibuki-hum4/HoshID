"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABELS,
  accountStatusVariant,
  isAccountStatus,
} from "@/lib/account-status";

import { approveApplication, rejectApplication } from "./actions";

type Application = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  discordLinked: boolean;
  inGuild: boolean;
  image: string | null;
  status: string;
  appliedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  reviewNote: string | null;
};

type Message = { kind: "ok" | "error"; text: string };

/** 済んでいるかどうかを ◯ / ✕ で示す。色だけに頼らない。 */
function Mark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-foreground" : "text-muted-foreground"}>
      <span aria-hidden>{ok ? "◯" : "✕"}</span>
      <span className="sr-only">{ok ? "済" : "未"}</span> {label}
    </span>
  );
}

export function ApplicationList({
  selfId,
  applications,
}: {
  selfId: string;
  applications: Application[];
}) {
  const [message, setMessage] = useState<Message | null>(null);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();


  function approve(application: Application) {
    setMessage(null);
    startTransition(async () => {
      const result = await approveApplication(application.id);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setMessage({
        kind: result.mailFailed ? "error" : "ok",
        text: result.alreadyReviewed
          ? "この申請は既に審査済みでした。"
          : result.mailFailed
            ? `${application.name} さんを承認しましたが、通知メールを送れませんでした。`
            : `${application.name} さんを承認し、通知メールを送りました。`,
      });
    });
  }

  function confirmReject() {
    if (!rejecting) return;
    const target = rejecting;

    setMessage(null);
    startTransition(async () => {
      const result = await rejectApplication(target.id, reason);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setRejecting(null);
      setReason("");
      setMessage({
        kind: result.mailFailed ? "error" : "ok",
        text: result.alreadyReviewed
          ? "この申請は既に審査済みでした。"
          : result.mailFailed
            ? `${target.name} さんの申請を却下しましたが、通知メールを送れませんでした。`
            : `${target.name} さんの申請を却下し、通知メールを送りました。`,
      });
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>申請者</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="whitespace-nowrap">申請日時</TableHead>
              <TableHead>審査</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  該当する申請はありません。
                </TableCell>
              </TableRow>
            ) : null}

            {applications.map((application) => {
              // 審査できるのは Prepared の行だけ。「すべて」表示でも
              // 審査待ちの行だけは操作できるようにする。
              const reviewable = application.status === ACCOUNT_STATUS.prepared;

              return (
              <TableRow key={application.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 shrink-0">
                      {application.image ? (
                        <AvatarImage src={application.image} alt="" />
                      ) : null}
                      <AvatarFallback>{application.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{application.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {application.email}
                      </p>
                      {/*
                        承認の判断材料。**済んでいない方だけを目立たせるのでは
                        なく、両方を常に出す。** 「表示が無い＝まだ読み込んで
                        いない」のか「済んでいる」のか分からなくなるため。

                        確認できていないアドレスは本人のものである保証が無く、
                        承認するとそのアドレスが email クレームとして RP に渡る。
                      */}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <Mark ok={application.emailVerified} label="メール確認" />
                        <Mark ok={application.discordLinked} label="Discord 連携" />
                        {application.discordLinked ? (
                          <Mark ok={application.inGuild} label="サーバ参加" />
                        ) : null}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      isAccountStatus(application.status)
                        ? accountStatusVariant(application.status)
                        : "outline"
                    }
                  >
                    {isAccountStatus(application.status)
                      ? ACCOUNT_STATUS_LABELS[application.status]
                      : application.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {application.appliedAt
                    ? new Date(application.appliedAt).toLocaleString("ja-JP")
                    : "—"}
                </TableCell>

                <TableCell className="max-w-xs">
                  {application.reviewedAt ? (
                    <div className="text-xs">
                      <p className="text-muted-foreground">
                        {new Date(application.reviewedAt).toLocaleString("ja-JP")} ·{" "}
                        {application.reviewerName ?? "不明"}
                      </p>
                      {application.reviewNote ? (
                        <p className="mt-0.5 whitespace-pre-wrap">
                          {application.reviewNote}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>

                <TableCell className="text-right whitespace-nowrap">
                  {reviewable ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${application.name} の申請を却下`}
                        disabled={pending || application.id === selfId}
                        onClick={() => {
                          setRejecting(application);
                          setReason("");
                        }}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${application.name} を承認`}
                        disabled={pending || application.id === selfId}
                        onClick={() => approve(application)}
                      >
                        <Check className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申請を却下します</DialogTitle>
            <DialogDescription>
              {rejecting?.name} さんの申請を却下します。理由は記録として残ります。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="reject-reason">却下の理由</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="なぜ承認しないのかを書いてください。"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejecting(null)}
            >
              やめる
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length === 0}
              onClick={confirmReject}
            >
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
