/**
 * Webhook の種別。
 *
 * クライアントコンポーネントからも使うため、サーバ専用の依存（Prisma など）を
 * 持ち込まないよう `lib/webhook.ts` から切り出してある。ここに DB や fetch の
 * 処理を書かないこと。書くとブラウザ側のバンドルに Prisma が混入する。
 */
export const WEBHOOK_KINDS = {
  discord: "Discord",
  slack: "Slack",
} as const;

export type WebhookKind = keyof typeof WEBHOOK_KINDS;

export function isWebhookKind(value: unknown): value is WebhookKind {
  return typeof value === "string" && value in WEBHOOK_KINDS;
}

/** 通知する出来事。 */
export type WebhookEvent =
  | { type: "application.submitted"; name: string; email: string }
  | { type: "application.approved"; name: string; email: string; reviewer: string }
  | {
      type: "application.rejected";
      name: string;
      email: string;
      reviewer: string;
      reason: string;
    }
  | {
      type: "report.submitted";
      category: string;
      body: string;
      /** 匿名で送られることもある。 */
      reporter: string | null;
    };
