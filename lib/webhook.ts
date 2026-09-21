import { prisma } from "@/lib/prisma";
import {
  WEBHOOK_KINDS,
  type WebhookEvent,
  type WebhookKind,
} from "@/lib/webhook-kinds";

export type { WebhookEvent, WebhookKind };

/**
 * Webhook URL を検証する。
 *
 * **https のみ、かつ Discord / Slack の正規ホストだけを通す。** 任意の URL を
 * 登録できると、HoshID のサーバから内部ネットワーク宛にリクエストを送らせる
 * SSRF の踏み台になる。ここは緩めないこと。
 */
export function validateWebhookUrl(
  kind: WebhookKind,
  rawUrl: string,
): { ok: true; url: string } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, message: "URL の形式が正しくありません。" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, message: "https の URL のみ登録できます。" };
  }

  const allowed: Record<WebhookKind, string[]> = {
    discord: ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"],
    slack: ["hooks.slack.com"],
  };

  if (!allowed[kind].includes(url.hostname)) {
    return {
      ok: false,
      message: `${WEBHOOK_KINDS[kind]} の Webhook URL ではありません（${allowed[kind][0]} 等）。`,
    };
  }

  if (kind === "discord" && !url.pathname.startsWith("/api/webhooks/")) {
    return { ok: false, message: "Discord の Webhook URL の形式ではありません。" };
  }

  return { ok: true, url: url.toString() };
}

function describeEvent(event: WebhookEvent): {
  title: string;
  body: string;
  color: number;
} {
  switch (event.type) {
    case "application.submitted":
      return {
        title: "新しいアカウント申請",
        body: `${event.name}（${event.email}）が申請しました。`,
        color: 0x5865f2,
      };
    case "application.approved":
      return {
        title: "申請を承認しました",
        body: `${event.name}（${event.email}）を ${event.reviewer} が承認しました。`,
        color: 0x2ecc71,
      };
    case "application.rejected":
      return {
        title: "申請を却下しました",
        body: `${event.name}（${event.email}）を ${event.reviewer} が却下しました。\n理由: ${event.reason}`,
        color: 0xe74c3c,
      };
    case "report.submitted":
      return {
        title: `お問い合わせ: ${event.category}`,
        body: `${event.reporter ? `${event.reporter} さんから` : "匿名で"}届きました。

${event.body}`,
        color: 0xf1c40f,
      };
  }
}

function buildPayload(kind: WebhookKind, event: WebhookEvent): unknown {
  const { title, body, color } = describeEvent(event);

  if (kind === "slack") {
    return { text: `*${title}*\n${body}` };
  }

  return {
    username: "HoshID",
    embeds: [
      {
        title,
        description: body,
        color,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * 登録済みの Webhook すべてに通知する。
 *
 * **失敗しても呼び出し元の処理を巻き戻さない。** 申請の受理や承認が
 * 通知の成否に引きずられてはいけない。
 */
export async function notifyWebhooks(event: WebhookEvent): Promise<void> {
  const webhooks = await prisma.webhook
    .findMany({ where: { enabled: true, events: { has: event.type } } })
    .catch(() => []);

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const controller = new AbortController();
      // 通知先が応答しないときに申請処理を待たせない。
      const timeout = setTimeout(() => controller.abort(), 5_000);

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            buildPayload(webhook.kind as WebhookKind, event),
          ),
          signal: controller.signal,
        });

        await prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            lastSentAt: new Date(),
            lastError: response.ok ? null : `HTTP ${response.status}`,
          },
        });
      } catch (error) {
        await prisma.webhook
          .update({
            where: { id: webhook.id },
            data: {
              lastSentAt: new Date(),
              lastError: error instanceof Error ? error.message : "送信に失敗しました",
            },
          })
          .catch(() => undefined);
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
}
