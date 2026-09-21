import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 法的文書とヘルプの共通レイアウト。ログインの有無に関わらず読める。 */
export default function DocumentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/">
          <ArrowLeft className="size-4" aria-hidden />
          HoshID に戻る
        </Link>
      </Button>

      {children}
    </div>
  );
}
