"use server";

import { getCurrentSession } from "@/lib/session";
import { notifyWebhooks } from "@/lib/webhook";

import {
  isReportCategory,
  REPORT_CATEGORIES,
  REPORT_MAX_BODY,
} from "./categories";

export type ReportResult = { ok: true } | { ok: false; message: string };

/**
 * お問い合わせを運営に送る。
 *
 * **ログインしていなくても送れる。** 「ログインできない」という問い合わせが
 * 一番届いてほしいので、ここで認証を要求すると本末転倒になる。
 *
 * 送信先は登録済みの Webhook。DB に溜めない。読む画面が無いまま溜めると、
 * 届いたことに誰も気づかない状態になる。
 */
export async function submitReport(input: {
  category: string;
  body: string;
}): Promise<ReportResult> {
  const body = input.body.trim();

  if (!body) {
    return { ok: false, message: "内容を入力してください。" };
  }
  if (body.length > REPORT_MAX_BODY) {
    return { ok: false, message: `${REPORT_MAX_BODY}文字以内で入力してください。` };
  }
  if (!isReportCategory(input.category)) {
    return { ok: false, message: "種別が不正です。" };
  }

  // ログインしていれば誰からかを添える。していなければ匿名のまま送る。
  const session = await getCurrentSession().catch(() => null);
  const reporter = session ? `${session.user.name}（${session.user.email}）` : null;

  await notifyWebhooks({
    type: "report.submitted",
    category: REPORT_CATEGORIES[input.category],
    body,
    reporter,
  });

  return { ok: true };
}
