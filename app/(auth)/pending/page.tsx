import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "アカウントをご利用いただけません" };

/**
 * 承認されていないアカウントでログインを試みた時の画面。
 *
 * 「審査中」と「却下済み」をこの画面では区別していない。区別するには
 * パスワード照合を通った後の状態を画面まで運ぶ必要があり、承認 UI と
 * 合わせて M2 で実装する。
 */
export default function PendingPage() {
  return (
    <Card className="rounded-3xl text-center shadow-sm">
      <CardHeader>
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          <Clock className="size-6" aria-hidden />
        </div>
        <CardTitle className="mt-4 text-2xl">
          まだご利用いただけません
        </CardTitle>
        <CardDescription>
          このアカウントは管理者の承認待ち、または承認されませんでした。
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-muted-foreground text-sm">
          承認されるとメールでお知らせします。お心当たりがない場合は管理者にお問い合わせください。
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
