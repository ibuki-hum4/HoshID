"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { LINK_KINDS, MAX_LINKS } from "@/lib/links";

import { saveLinks, updateProfile } from "./actions";

type LinkRow = { kind: string; label: string; url: string };

export function ProfileSection({
  nickname: initialNickname,
  bio: initialBio,
  name,
  email,
  links: initialLinks,
}: {
  nickname: string;
  bio: string;
  name: string;
  email: string;
  links: LinkRow[];
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio);
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((current) =>
      current.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    );
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks((current) => [...current, { kind: "custom", label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    setLinks((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const profileResult = await updateProfile({ nickname, bio });
      if (!profileResult.ok) {
        setMessage({ kind: "error", text: profileResult.message });
        return;
      }

      const linkResult = await saveLinks(links);
      if (!linkResult.ok) {
        setMessage({ kind: "error", text: linkResult.message });
        return;
      }

      setMessage({ kind: "ok", text: "保存しました。" });
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">プロフィール</CardTitle>
          <CardDescription>
            ニックネームと自己紹介は、連携したアプリに渡ることがあります。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>表示名</Label>
            <Input value={name} readOnly disabled />
          </div>

          <div className="grid gap-2">
            <Label>メールアドレス</Label>
            <Input value={email} readOnly disabled />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nickname">ニックネーム</Label>
            <Input
              id="nickname"
              value={nickname}
              maxLength={32}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="呼ばれたい名前"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bio">自己紹介</Label>
            <Textarea
              id="bio"
              rows={4}
              value={bio}
              maxLength={500}
              onChange={(event) => setBio(event.target.value)}
              placeholder="どんな人かを一言で。"
            />
            <p className="text-muted-foreground text-xs">{bio.length} / 500</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">リンク</CardTitle>
          <CardDescription>
            SNS や自分のサイトを並べられます（{MAX_LINKS}件まで）。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {links.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              まだリンクがありません。
            </p>
          ) : null}

          {links.map((link, index) => (
            <div
              key={index}
              className="bg-muted/40 grid gap-2 rounded-lg p-3 sm:grid-cols-[auto_9rem_1fr_auto] sm:items-center"
            >
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="上へ移動"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <GripVertical className="size-4 rotate-90" aria-hidden />
                </Button>
              </div>

              <select
                aria-label="種別"
                value={link.kind}
                onChange={(event) => updateLink(index, { kind: event.target.value })}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {Object.entries(LINK_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <div className="grid gap-2">
                <Input
                  value={link.label}
                  maxLength={40}
                  placeholder="表示名"
                  onChange={(event) => updateLink(index, { label: event.target.value })}
                />
                <Input
                  value={link.url}
                  inputMode="url"
                  placeholder="https://example.com/you"
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="このリンクを削除"
                onClick={() => removeLink(index)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            disabled={links.length>= MAX_LINKS}
            onClick={addLink}
          >
            <Plus className="size-4" aria-hidden />
            リンクを追加
          </Button>
        </CardContent>

        <CardFooter className="justify-end">
          <Button  disabled={pending} onClick={save}>
            {pending ? "保存しています…" : "プロフィールを保存"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
