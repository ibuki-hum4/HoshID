"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { isAccountStatus, type AccountStatus } from "@/lib/account-status";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authorize";
import {
  revokeDiscordRoleBeforeDelete,
  syncDiscordRole,
} from "@/lib/discord-role";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type MemberActionResult = { ok: true } | { ok: false; message: string };

const ASSIGNABLE_ROLES = ["user", "officer", "admin"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * メンバーのステータスとロールを更新する。
 *
 * ステータスはログインの可否を直接決めるので、`set-role` ではなく
 * ユーザー管理そのものの権限（`user: ["set-role"]`）を要求する。役員には
 * 付けていない。審査はできても、他人を管理者に昇格させられては困るため。
 */
export async function updateMember(input: {
  userId: string;
  status: string;
  role: string;
}): Promise<MemberActionResult> {
  const actor = await requirePermission({ user: ["set-role"] });

  if (!isAccountStatus(input.status)) {
    return { ok: false, message: "不正なステータスです。" };
  }
  if (!isAssignableRole(input.role)) {
    return { ok: false, message: "不正なロールです。" };
  }

  // 自分のロールとステータスは変えられない。最後の管理者が自分の権限を
  // 落として誰も管理できなくなる事故と、自分を停止する事故を防ぐ。
  if (actor.id === input.userId) {
    return {
      ok: false,
      message: "自分自身のロールとステータスは変更できません。",
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { role: true },
  });

  if (!target) {
    return { ok: false, message: "対象のアカウントが見つかりませんでした。" };
  }

  // 管理者を減らしすぎて誰も管理できなくなるのを防ぐ。
  if (target.role === "admin" && input.role !== "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return { ok: false, message: "管理者が0人になる変更はできません。" };
    }
  }

  const before = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true, status: true, role: true },
  });

  await prisma.user.update({
    where: { id: input.userId },
    data: { status: input.status as AccountStatus, role: input.role },
  });

  if (before) {
    await recordAudit({
      actor: actor,
      action: "member.update",
      targetType: "user",
      targetId: input.userId,
      targetLabel: `${before.name}（${before.email}）`,
      // 変更前後を残す。後から「誰がいつ権限を上げたか」を追える。
      detail: `ステータス: ${before.status} → ${input.status} / ロール: ${before.role ?? "user"} → ${input.role}`,
    });
  }

  // ステータスが変われば Discord 側の扱いも変える。ロールを持つのは
  // active だけで、ログインできる状態と一致させる。
  await syncDiscordRole(input.userId);

  revalidatePath("/lounge/admin/members");
  revalidatePath("/lounge/members");
  return { ok: true };
}

/**
 * アカウントを削除する。
 *
 * ユーザーに紐づくセッション・連携・アプリも外部キーの CASCADE で消える。
 * 取り消せないので、呼び出し側で必ず確認を挟むこと。
 */
export async function deleteMember(userId: string): Promise<MemberActionResult> {
  const actor = await requirePermission({ user: ["delete"] });

  if (actor.id === userId) {
    return { ok: false, message: "自分自身のアカウントは削除できません。" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true, email: true },
  });

  if (!target) {
    return { ok: false, message: "対象のアカウントが見つかりませんでした。" };
  }

  if (target.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return { ok: false, message: "最後の管理者は削除できません。" };
    }
  }

  // **消す前にロールを外す。** 削除すると連携も CASCADE で消えるため、
  // 後からでは誰の Discord だったのか分からなくなる。
  await revokeDiscordRoleBeforeDelete(userId);

  try {
    await auth.api.removeUser({
      headers: await headers(),
      body: { userId },
    });
  } catch {
    return { ok: false, message: "削除できませんでした。" };
  }

  await recordAudit({
    actor,
    action: "member.delete",
    targetType: "user",
    targetId: userId,
    targetLabel: `${target.name}（${target.email}）`,
    detail: `ロール: ${target.role ?? "user"}`,
  });

  revalidatePath("/lounge/admin/members");
  revalidatePath("/lounge/members");
  return { ok: true };
}
