"use client";

import { Eye, PenLine, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
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
  ANNOUNCEMENT_LEVELS,
  ANNOUNCEMENT_MAX_BODY,
  ANNOUNCEMENT_MAX_TITLE,
  announcementVariant,
  isAnnouncementLevel,
  toPlainExcerpt,
} from "@/lib/announcement";

import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "./actions";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  level: string;
  pinned: boolean;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  authorName: string | null;
};

const EMPTY = {
  title: "",
  body: "",
  level: "info",
  pinned: false,
  published: true,
  notifyByEmail: false,
};

export function AnnouncementManager({
  announcements,
}: {
  announcements: AnnouncementRow[];
}) {
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();

  // 「重要」は受信設定を無視して送るため、送る・送らないを選ばせない。
  const isCritical = form.level === "critical";

  function openCreate() {
    setForm(EMPTY);
    setCreating(true);
    setMessage(null);
  }

  function openEdit(announcement: AnnouncementRow) {
    setForm({
      title: announcement.title,
      body: announcement.body,
      level: announcement.level,
      pinned: announcement.pinned,
      published: announcement.published,
      // 編集では送らない。同じ内容を二度送りつけないため。
      notifyByEmail: false,
    });
    setEditing(announcement);
    setMessage(null);
  }

  function save() {
    const target = editing;

    startTransition(async () => {
      const result = target
        ? await updateAnnouncement(target.id, form)
        : await createAnnouncement(form);

      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }

      setCreating(false);
      setEditing(null);

      const { mailSent, mailFailed } = result;
      const mail =
        mailSent === undefined
          ? ""
          : mailFailed
            ? `${mailSent} 件に送信、${mailFailed} 件は送れませんでした。`
            : `${mailSent} 件にメールを送りました。`;

      setMessage({
        kind: mailFailed ? "error" : "ok",
        text: target
          ? "お知らせを更新しました。"
          : form.published
            ? `お知らせを公開しました。${mail}`
            : "下書きとして保存しました。",
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

      <Button onClick={openCreate} disabled={pending}>
        <Plus className="size-4" aria-hidden />
        お知らせを書く
      </Button>

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>見出し</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="whitespace-nowrap">作成</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  まだお知らせはありません。
                </TableCell>
              </TableRow>
            ) : null}

            {announcements.map((announcement) => {
              const level = isAnnouncementLevel(announcement.level)
                ? announcement.level
                : "info";

              return (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <p className="font-medium">{announcement.title}</p>
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {toPlainExcerpt(announcement.body, 80)}
                    </p>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={announcementVariant(level)}
                      className="rounded-full"
                    >
                      {ANNOUNCEMENT_LEVELS[level]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={announcement.published ? "secondary" : "outline"}
                        className="rounded-full"
                      >
                        {announcement.published ? "公開中" : "下書き"}
                      </Badge>
                      {announcement.pinned ? (
                        <Badge variant="outline" className="rounded-full">
                          固定
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(announcement.createdAt).toLocaleDateString("ja-JP")}
                    {announcement.authorName ? ` · ${announcement.authorName}` : null}
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${announcement.title} を編集`}
                      disabled={pending}
                      onClick={() => openEdit(announcement)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${announcement.title} を削除`}
                      disabled={pending}
                      onClick={() => {
                        setDeleting(announcement);
                        setMessage(null);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "お知らせを編集" : "お知らせを書く"}</DialogTitle>
            <DialogDescription>
              公開すると全メンバーのダッシュボードとお知らせ一覧に出ます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="announcement-title">見出し</Label>
              <Input
                id="announcement-title"
                value={form.title}
                maxLength={ANNOUNCEMENT_MAX_TITLE}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="announcement-body">本文</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreview((current) => !current)}
                >
                  {preview ? (
                    <>
                      <PenLine className="size-4" aria-hidden />
                      編集に戻る
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" aria-hidden />
                      表示を確認
                    </>
                  )}
                </Button>
              </div>

              {preview ? (
                <div className="min-h-[12rem] rounded-md border p-3">
                  {form.body.trim() ? (
                    <Markdown>{form.body}</Markdown>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      本文がまだ空です。
                    </p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="announcement-body"
                  rows={10}
                  value={form.body}
                  maxLength={ANNOUNCEMENT_MAX_BODY}
                  className="font-mono text-sm"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, body: event.target.value }))
                  }
                />
              )}

              <p className="text-muted-foreground text-xs">
                Markdown が使えます（見出し・箇条書き・強調・リンク・表・コード）。
                HTML は書いても無効になります。
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="announcement-level">種別</Label>
              <Select
                value={form.level}
                onValueChange={(level) =>
                  setForm((current) => ({ ...current, level }))
                }
              >
                <SelectTrigger id="announcement-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANNOUNCEMENT_LEVELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">先頭に固定する</p>
                <p className="text-muted-foreground text-xs">
                  一覧とダッシュボードで常に上に出ます。
                </p>
              </div>
              <Switch
                checked={form.pinned}
                onCheckedChange={(pinned) =>
                  setForm((current) => ({ ...current, pinned }))
                }
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">公開する</p>
                <p className="text-muted-foreground text-xs">
                  外すと下書きになり、管理者以外には見えません。
                </p>
              </div>
              <Switch
                checked={form.published}
                onCheckedChange={(published) =>
                  setForm((current) => ({ ...current, published }))
                }
              />
            </div>

            {editing ? null : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">メールでも通知する</p>
                  <p className="text-muted-foreground text-xs">
                    {!form.published
                      ? "公開しないと送られません。"
                      : isCritical
                        ? "「重要」は受信設定に関わらず必ず送ります。切り替えられません。"
                        : "受け取る設定にしているメンバーに届きます。送ったあとは取り消せません。"}
                  </p>
                </div>
                <Switch
                  checked={isCritical ? true : form.notifyByEmail}
                  disabled={!form.published || isCritical}
                  onCheckedChange={(notifyByEmail) =>
                    setForm((current) => ({ ...current, notifyByEmail }))
                  }
                />
              </div>
            )}

            {form.published && (form.notifyByEmail || isCritical) ? (
              <Alert variant={isCritical ? "destructive" : "default"}>
                <AlertDescription>
                  {isCritical
                    ? "「重要」は、メールを受け取らない設定にしている人にも届きます。本当に全員へ知らせる必要がある内容か確かめてください。"
                    : "全員のメールボックスに届きます。内容をプレビューで確認してから公開してください。"}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              やめる
            </Button>
            <Button disabled={pending} onClick={save}>
              {pending
                ? "保存しています…"
                : editing
                  ? "変更を保存"
                  : form.published
                    ? form.notifyByEmail || isCritical
                      ? "公開してメールを送る"
                      : "公開して全員に見せる"
                    : "下書きとして保存"}
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
            <DialogTitle>お知らせを削除します</DialogTitle>
            <DialogDescription>
              「{deleting?.title}」を削除します。全メンバーの画面から消え、元に戻せません。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              やめる
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                startTransition(async () => {
                  const result = await deleteAnnouncement(target.id);
                  if (!result.ok) {
                    setMessage({ kind: "error", text: result.message });
                    return;
                  }
                  setDeleting(null);
                  setMessage({ kind: "ok", text: "お知らせを削除しました。" });
                });
              }}
            >
              完全に削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
