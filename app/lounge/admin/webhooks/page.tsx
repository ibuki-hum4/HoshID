import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

import { WebhookManager } from "./webhook-manager";

export const metadata = { title: "Webhook" };

export default async function WebhooksPage() {
  await requirePermission({ user: ["set-role"] });

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1>Webhook</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          アカウント申請などの出来事を Discord や Slack に通知します。
        </p>
      </div>

      <WebhookManager
        webhooks={webhooks.map((webhook) => ({
          id: webhook.id,
          kind: webhook.kind,
          label: webhook.label,
          // URL 自体はトークンを含む秘密情報なので、ホストまでしか見せない。
          urlHost: safeHost(webhook.url),
          events: webhook.events,
          enabled: webhook.enabled,
          lastSentAt: webhook.lastSentAt?.toISOString() ?? null,
          lastError: webhook.lastError,
        }))}
      />
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(不正な URL)";
  }
}
