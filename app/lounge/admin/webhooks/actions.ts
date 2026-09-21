"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { notifyWebhooks, validateWebhookUrl } from "@/lib/webhook";
import { isWebhookKind, type WebhookKind } from "@/lib/webhook-kinds";

export type WebhookResult = { ok: true } | { ok: false; message: string };

const EVENT_VALUES = [
  "application.submitted",
  "application.approved",
  "application.rejected",
  "report.submitted",
] as const;

/** Webhook の管理は管理者だけ。通知先を差し替えられると情報の流出先になる。 */
function requireWebhookAdmin() {
  return requirePermission({ user: ["set-role"] });
}

export async function createWebhook(input: {
  kind: string;
  label: string;
  url: string;
  events: string[];
}): Promise<WebhookResult> {
  const actor = await requireWebhookAdmin();

  if (!isWebhookKind(input.kind)) {
    return { ok: false, message: "種別が不正です。" };
  }

  const label = input.label.trim();
  if (!label) {
    return { ok: false, message: "名前を入力してください。" };
  }

  const validated = validateWebhookUrl(input.kind as WebhookKind, input.url);
  if (!validated.ok) {
    return validated;
  }

  const events = input.events.filter((event) =>
    (EVENT_VALUES as readonly string[]).includes(event),
  );
  if (events.length === 0) {
    return { ok: false, message: "通知する出来事を1つ以上選んでください。" };
  }

  const created = await prisma.webhook.create({
    data: {
      kind: input.kind,
      label,
      url: validated.url,
      events,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: "webhook.create",
    targetType: "webhook",
    targetId: created.id,
    // URL は載せない。Discord も Slack も URL そのものが投稿の鍵なので、
    // 監査ログに書くと閲覧できる人全員に通知先を乗っ取る手段を渡すことになる。
    targetLabel: `${label}（${input.kind}）`,
    detail: `通知: ${events.join(", ")}`,
  });

  revalidatePath("/lounge/admin/webhooks");
  return { ok: true };
}

export async function setWebhookEnabled(
  id: string,
  enabled: boolean,
): Promise<WebhookResult> {
  const actor = await requireWebhookAdmin();

  const webhook = await prisma.webhook.update({
    where: { id },
    data: { enabled },
    select: { label: true, kind: true },
  });

  await recordAudit({
    actor,
    action: "webhook.update",
    targetType: "webhook",
    targetId: id,
    targetLabel: `${webhook.label}（${webhook.kind}）`,
    detail: enabled ? "有効にした" : "無効にした",
  });

  revalidatePath("/lounge/admin/webhooks");
  return { ok: true };
}

export async function deleteWebhook(id: string): Promise<WebhookResult> {
  const actor = await requireWebhookAdmin();

  const target = await prisma.webhook.findUnique({
    where: { id },
    select: { label: true, kind: true },
  });

  await prisma.webhook.delete({ where: { id } });

  await recordAudit({
    actor,
    action: "webhook.delete",
    targetType: "webhook",
    targetId: id,
    targetLabel: target ? `${target.label}（${target.kind}）` : undefined,
  });

  revalidatePath("/lounge/admin/webhooks");
  return { ok: true };
}

/** 動作確認用にテスト通知を1件送る。 */
export async function sendTestNotification(id: string): Promise<WebhookResult> {
  const actor = await requireWebhookAdmin();

  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return { ok: false, message: "対象の Webhook が見つかりませんでした。" };
  }

  // 一時的にこの1件だけへ送るため、イベント種別を合わせて呼び出す。
  await notifyWebhooks({
    type: "application.submitted",
    name: `テスト送信（${actor.name}）`,
    email: "test@example.invalid",
  });

  const updated = await prisma.webhook.findUnique({
    where: { id },
    select: { lastError: true },
  });

  if (updated?.lastError) {
    return { ok: false, message: `送信に失敗しました: ${updated.lastError}` };
  }

  revalidatePath("/lounge/admin/webhooks");
  return { ok: true };
}
