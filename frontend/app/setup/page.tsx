import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import SetupForm from "./SetupForm";

// 管理者の有無はリクエスト時点のDB状態に依存するため、静的プリレンダリングを無効化する
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const adminCount = await prisma.user.count({ where: { role: "admin" } });

  if (adminCount > 0) {
    redirect("/sign-in");
  }

  return <SetupForm />;
}
