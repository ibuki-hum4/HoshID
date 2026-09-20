import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "申請を受け付けました" };

export default function ApplySubmittedPage() {
  return (
    <Card className="rounded-3xl text-center shadow-sm">
      <CardHeader>
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <CardTitle className="mt-4 text-2xl">申請を受け付けました</CardTitle>
        <CardDescription>
          管理者が内容を確認します。承認されるとメールでお知らせします。
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-muted-foreground text-sm">
          承認されるまではログインできません。しばらくお待ちください。
        </p>
      </CardContent>

      <CardFooter>
        <Button asChild variant="ghost" className="mx-auto rounded-full">
          <Link href="/sign-in">ログイン画面へ戻る</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
