"use client";

import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { submitReport } from "./actions";
import { REPORT_CATEGORIES, REPORT_MAX_BODY } from "./categories";

export function ReportForm() {
  const [category, setCategory] = useState("bug");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" aria-hidden />
          </div>
          <CardTitle className="mt-4">送信しました</CardTitle>
          <CardDescription>
            運営に届きました。返信が必要な内容の場合、登録のメールアドレス宛に
            連絡が行くことがあります。
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center gap-2">
          <Button variant="ghost" onClick={() => setSent(false)}>
            続けて送る
          </Button>
          <Button asChild variant="outline">
            <Link href="/help/faq">よくある質問を見る</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>内容をお書きください</CardTitle>
        <CardDescription>
          不具合の場合は、何をしたときに何が起きたかを書いていただけると助かります。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="report-category">種別</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="report-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REPORT_CATEGORIES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-body">内容</Label>
          <Textarea
            id="report-body"
            rows={8}
            value={body}
            maxLength={REPORT_MAX_BODY}
            placeholder="例: ログイン画面でパスキーのボタンを押すと、何も起きずに画面が止まります。"
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            パスワードや確認コードは書かないでください。運営が尋ねることはありません。
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          disabled={pending || body.trim().length === 0}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await submitReport({ category, body });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setBody("");
              setSent(true);
            });
          }}
        >
          <Send className="size-4" aria-hidden />
          {pending ? "送信しています…" : "運営に送る"}
        </Button>
      </CardFooter>
    </Card>
  );
}
