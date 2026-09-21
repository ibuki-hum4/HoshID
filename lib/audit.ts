import { getIP } from "@better-auth/core/utils/ip";
import { headers } from "next/headers";


import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

/**
 * 管理操作の記録。
 *
 * **記録に失敗しても、元の操作は巻き戻さない。** 承認できたのにログを書けず
 * 承認が取り消される、という方が困る。ただし黙って消さず、サーバのログには
 * 残す。
 *
 * 記録するのは「誰かの権限で、他人や全体に影響する操作」だけ。本人が自分の
 * プロフィールを変えたような操作まで入れると、量に埋もれて肝心な記録が
 * 見つからなくなる。
 */

export const AUDIT_ACTIONS = {
  "application.approve": "申請を承認",
  "application.reject": "申請を却下",
  "member.update": "メンバーを更新",
  "member.delete": "メンバーを削除",
  "client.verify": "アプリを検証済みに",
  "client.unverify": "アプリの検証を解除",
  "client.delete": "アプリを削除",
  "announcement.create": "お知らせを作成",
  "announcement.update": "お知らせを更新",
  "announcement.delete": "お知らせを削除",
  "webhook.create": "通知先を追加",
  "webhook.update": "通知先を変更",
  "webhook.delete": "通知先を削除",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && value in AUDIT_ACTIONS;
}

export async function recordAudit(input: {
  actor: CurrentUser;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** 対象の名前。対象が消えた後も読めるよう、その時点の値を写す。 */
  targetLabel?: string;
  detail?: string;
}): Promise<void> {
  try {
    const requestHeaders = await headers();

    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        // 行為者が退会しても辿れるよう、名前とメールを写しておく。
        actorLabel: `${input.actor.nickname || input.actor.name}（${input.actor.email}）`,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        detail: input.detail ?? null,
        // **`x-forwarded-for` の左端を直接読まないこと。** その値はクライアント
        // が自分で詰められるので、監査ログの IP を偽装できてしまう。信頼する
        // プロキシの設定を踏まえた解決を Better Auth と共有する（lib/request-ip.ts）。
        // 特定できないときは記録しない。当てにならない値を残す方が害が大きい。
        ipAddress: getIP(requestHeaders, auth.options),
        userAgent: requestHeaders.get("user-agent"),
      },
    });
  } catch (error) {
    console.warn("[HoshID] 監査ログを記録できませんでした:", error);
  }
}
