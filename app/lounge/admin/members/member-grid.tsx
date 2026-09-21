"use client";

import { Pencil, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_STATUS_DESCRIPTIONS,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VALUES,
  accountStatusVariant,
  isAccountStatus,
} from "@/lib/account-status";

import { deleteMember, updateMember } from "./actions";

export type MemberRow = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  image: string | null;
  role: string;
  status: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  officer: "役員",
  user: "一般",
};

export function MemberGrid({
  members,
  selfId,
}: {
  members: MemberRow[];
  selfId: string;
}) {
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState<MemberRow | null>(null);
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  /** 削除確認の段数。1 から始まり、最終段で実行する。 */
  const [deleteStep, setDeleteStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  // 管理者の削除は取り返しがつかない上、他の管理者を巻き込むので段数を増やす。
  const deleteSteps = deleting?.role === "admin" ? 3 : 2;

  function openEdit(member: MemberRow) {
    setEditing(member);
    setStatus(member.status);
    setRole(member.role);
    setMessage(null);
  }

  function save() {
    if (!editing) return;
    const target = editing;

    startTransition(async () => {
      const result = await updateMember({ userId: target.id, status, role });
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setEditing(null);
      setMessage({ kind: "ok", text: `${target.name} さんを更新しました。` });
    });
  }

  function startDelete(member: MemberRow) {
    setDeleting(member);
    setDeleteStep(1);
    setConfirmText("");
    setMessage(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;

    startTransition(async () => {
      const result = await deleteMember(target.id);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setDeleting(null);
      setMessage({ kind: "ok", text: `${target.name} さんを削除しました。` });
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
              <TableHead>メンバー</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  該当するメンバーはいません。
                </TableCell>
              </TableRow>
            ) : null}

            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 shrink-0">
                      {member.image ? <AvatarImage src={member.image} alt="" /> : null}
                      <AvatarFallback>
                        {(member.nickname || member.name).slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.nickname || member.name}
                        {member.id === selfId ? (
                          <span className="text-muted-foreground ml-2 text-xs">
                            あなた
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      isAccountStatus(member.status)
                        ? accountStatusVariant(member.status)
                        : "outline"
                    }
                  >
                    {isAccountStatus(member.status)
                      ? ACCOUNT_STATUS_LABELS[member.status]
                      : member.status}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge variant="outline">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(member.createdAt).toLocaleDateString("ja-JP")}
                </TableCell>

                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${member.name} を編集`}
                    title={
                      member.id === selfId
                        ? "自分自身は操作できません"
                        : `${member.name} を編集`
                    }
                    disabled={pending || member.id === selfId}
                    onClick={() => openEdit(member)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${member.name} を削除`}
                    title={
                      member.id === selfId
                        ? "自分自身は操作できません"
                        : `${member.name} を削除`
                    }
                    disabled={pending || member.id === selfId}
                    onClick={() => startDelete(member)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name} さんを編集</DialogTitle>
            <DialogDescription>
              ステータスはログインの可否を直接決めます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="member-status">ステータス</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="member-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_STATUS_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ACCOUNT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAccountStatus(status) ? (
                <p className="text-muted-foreground text-xs">
                  {ACCOUNT_STATUS_DESCRIPTIONS[status]}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-role">ロール</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">一般</SelectItem>
                  <SelectItem value="officer">役員</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
            >
              やめる
            </Button>
            <Button  disabled={pending} onClick={save}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              アカウントを削除します（{deleteStep} / {deleteSteps}）
            </DialogTitle>
            <DialogDescription>
              {deleteStep === 1
                ? `${deleting?.name} さんのアカウントを削除しようとしています。`
                : deleteStep === 2 && deleteSteps === 3
                  ? "このアカウントは管理者です。削除すると管理できる人が減ります。"
                  : "この操作は元に戻せません。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {deleteStep === 1 ? (
              <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                <li>ログイン中のセッションはすべて失効します</li>
                <li>連携アプリへの許可も取り消されます</li>
                <li>本人が登録した OAuth アプリも削除されます</li>
              </ul>
            ) : null}

            {deleteStep === deleteSteps ? (
              <div className="grid gap-2">
                <Label htmlFor="delete-confirm">
                  確認のため <strong>{deleting?.email}</strong> と入力してください
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirmText}
                  autoComplete="off"
                  onChange={(event) => setConfirmText(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
            >
              やめる
            </Button>

            {deleteStep < deleteSteps ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteStep((step) => step + 1)}
              >
                続ける
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={pending || confirmText !== deleting?.email}
                onClick={confirmDelete}
              >
                削除する
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
