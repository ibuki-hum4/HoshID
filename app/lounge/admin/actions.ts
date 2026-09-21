"use server";

import { revalidatePath } from "next/cache";

import { ACCOUNT_STATUS } from "@/lib/account-status";
import { recordAudit } from "@/lib/audit";
import { syncDiscordRole } from "@/lib/discord-role";
import { requireApplicationPermission } from "@/lib/authorize";
import {
  buildApprovalMail,
  buildRejectionMail,
  sendMail,
} from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { notifyWebhooks } from "@/lib/webhook";

export type ReviewResult =
  | { ok: true; alreadyReviewed?: boolean; mailFailed?: boolean }
  | { ok: false; message: string };

export async function approveApplication(userId: string): Promise<ReviewResult> {
  const reviewer = await requireApplicationPermission("approve");

  if (reviewer.id === userId) {
    return { ok: false, message: "自分自身の申請は承認できません。" };
  }

  // 冪等にする。二重承認で承認メールが2通飛ぶのを防ぐため、Prepared の時だけ
  // 更新し、更新件数で「実際に承認したのか」を判断する。
  const { count } = await prisma.user.updateMany({
    where: { id: userId, status: ACCOUNT_STATUS.prepared },
    data: {
      status: ACCOUNT_STATUS.active,
      reviewedAt: new Date(),
      reviewedBy: reviewer.id,
      reviewNote: null,
    },
  });

  revalidatePath("/lounge/admin");

  if (count === 0) {
    return { ok: true, alreadyReviewed: true };
  }

  // Discord のロールを状態に合わせる。**失敗しても審査は巻き戻さない。**
  // Discord が落ちているだけで承認が取り消される方が困る。
  await syncDiscordRole(userId);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (target) {
    await notifyWebhooks({
      type: "application.approved",
      name: target.name,
      email: target.email,
      reviewer: reviewer.name,
    }).catch(() => undefined);
  }

  // 送信に失敗しても承認は取り消さない。承認は既にコミット済み。
  if (target) {
    await recordAudit({
      actor: reviewer,
      action: "application.approve",
      targetType: "user",
      targetId: userId,
      targetLabel: `${target.name}（${target.email}）`,
    });

    const result = await sendMail(buildApprovalMail(target.name, target.email));
    if (!result.ok) {
      console.warn("[HoshID] 承認メールの送信に失敗しました:", result.reason);
      return { ok: true, mailFailed: true };
    }
  }

  return { ok: true };
}

export async function rejectApplication(
  userId: string,
  reason: string,
): Promise<ReviewResult> {
  const reviewer = await requireApplicationPermission("reject");

  const note = reason.trim();
  if (!note) {
    return { ok: false, message: "却下の理由を入力してください。" };
  }
  if (note.length > 500) {
    return { ok: false, message: "理由は500文字以内にしてください。" };
  }
  if (reviewer.id === userId) {
    return { ok: false, message: "自分自身の申請は却下できません。" };
  }

  const { count } = await prisma.user.updateMany({
    where: { id: userId, status: ACCOUNT_STATUS.prepared },
    data: {
      status: ACCOUNT_STATUS.rejected,
      reviewedAt: new Date(),
      reviewedBy: reviewer.id,
      reviewNote: note,
    },
  });

  revalidatePath("/lounge/admin");

  if (count === 0) {
    return { ok: true, alreadyReviewed: true };
  }

  // Discord のロールを状態に合わせる。**失敗しても審査は巻き戻さない。**
  // Discord が落ちているだけで承認が取り消される方が困る。
  await syncDiscordRole(userId);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (target) {
    await notifyWebhooks({
      type: "application.rejected",
      name: target.name,
      email: target.email,
      reviewer: reviewer.name,
      reason: note,
    }).catch(() => undefined);
  }

  if (target) {
    await recordAudit({
      actor: reviewer,
      action: "application.reject",
      targetType: "user",
      targetId: userId,
      targetLabel: `${target.name}（${target.email}）`,
      detail: note,
    });

    const result = await sendMail(buildRejectionMail(target.name, target.email, note));
    if (!result.ok) {
      console.warn("[HoshID] 却下メールの送信に失敗しました:", result.reason);
      return { ok: true, mailFailed: true };
    }
  }

  return { ok: true };
}
