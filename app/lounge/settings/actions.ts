"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { requireApprovedUser } from "@/lib/session";

export type SettingsResult = { ok: true } | { ok: false; message: string };

/** お知らせをメールでも受け取るかを切り替える。 */
export async function setAnnouncementNotification(
  enabled: boolean,
): Promise<SettingsResult> {
  await requireApprovedUser();

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { notifyAnnouncements: enabled },
    });
  } catch {
    return { ok: false, message: "設定を保存できませんでした。" };
  }

  revalidatePath("/lounge/settings");
  return { ok: true };
}
