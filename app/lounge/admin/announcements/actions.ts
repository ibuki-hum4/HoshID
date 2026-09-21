"use server";

import { revalidatePath } from "next/cache";

import {
  ANNOUNCEMENT_MAX_BODY,
  ANNOUNCEMENT_MAX_TITLE,
  isAnnouncementLevel,
} from "@/lib/announcement";
import { ACCOUNT_STATUS } from "@/lib/account-status";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authorize";
import { buildAnnouncementMail, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export type AnnouncementResult = { ok: true } | { ok: false; message: string };

type Input = {
  title: string;
  body: string;
  level: string;
  pinned: boolean;
  published: boolean;
  /** 公開と同時に、受け取る設定のメンバーへメールを送るか。 */
  notifyByEmail: boolean;
};

export type CreateResult =
  | { ok: true; mailSent?: number; mailFailed?: number }
  | { ok: false; message: string };

function validate(input: Input): { ok: true } | { ok: false; message: string } {
  if (!input.title.trim()) {
    return { ok: false, message: "見出しを入力してください。" };
  }
  if (input.title.length > ANNOUNCEMENT_MAX_TITLE) {
    return { ok: false, message: `見出しは${ANNOUNCEMENT_MAX_TITLE}文字以内にしてください。` };
  }
  if (!input.body.trim()) {
    return { ok: false, message: "本文を入力してください。" };
  }
  if (input.body.length > ANNOUNCEMENT_MAX_BODY) {
    return { ok: false, message: `本文は${ANNOUNCEMENT_MAX_BODY}文字以内にしてください。` };
  }
  if (!isAnnouncementLevel(input.level)) {
    return { ok: false, message: "種別が不正です。" };
  }
  return { ok: true };
}

/** お知らせを作る。全メンバーの画面に出るので管理者だけ。 */
export async function createAnnouncement(input: Input): Promise<CreateResult> {
  const actor = await requirePermission({ announcement: ["create"] });

  const validated = validate(input);
  if (!validated.ok) return validated;

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      level: input.level,
      pinned: input.pinned,
      published: input.published,
      // 公開に切り替えた瞬間を記録する。並び順の基準になる。
      publishedAt: input.published ? new Date() : null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: "announcement.create",
    targetType: "announcement",
    targetId: announcement.id,
    targetLabel: announcement.title,
    detail: input.published ? "公開" : "下書き",
  });

  revalidateAnnouncements();

  // 下書きでは送らない。送信の失敗でお知らせ自体を巻き戻さない。
  // 「重要」は受信設定に関わらず必ず送る。重要と名乗りながら届かないのは
  // 矛盾しているため、管理者が選ぶまでもなく送信する。
  const isCritical = input.level === "critical";

  if (input.published && (input.notifyByEmail || isCritical)) {
    const sent = await notifyMembers(announcement, { ignorePreference: isCritical });
    return { ok: true, ...sent };
  }

  return { ok: true };
}

export async function updateAnnouncement(
  id: string,
  input: Input,
): Promise<CreateResult> {
  const actor = await requirePermission({ announcement: ["update"] });

  const validated = validate(input);
  if (!validated.ok) return validated;

  const current = await prisma.announcement.findUnique({
    where: { id },
    select: { title: true, published: true, publishedAt: true },
  });

  if (!current) {
    return { ok: false, message: "対象のお知らせが見つかりませんでした。" };
  }

  await prisma.announcement.update({
    where: { id },
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      level: input.level,
      pinned: input.pinned,
      published: input.published,
      // 一度公開した日時は保つ。下書きに戻して再公開しても
      // 「いつ最初に出したか」が消えない。
      publishedAt: input.published ? (current.publishedAt ?? new Date()) : current.publishedAt,
    },
  });

  await recordAudit({
    actor,
    action: "announcement.update",
    targetType: "announcement",
    targetId: id,
    targetLabel: input.title.trim(),
    // 下書きと公開の行き来は影響が大きいので、変わった時だけ残す。
    detail:
      current.published === input.published
        ? undefined
        : `${current.published ? "公開" : "下書き"} → ${input.published ? "公開" : "下書き"}`,
  });

  revalidateAnnouncements();
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<AnnouncementResult> {
  const actor = await requirePermission({ announcement: ["delete"] });

  // 消す前に見出しを読む。消した後では何を消したか分からなくなる。
  const target = await prisma.announcement.findUnique({
    where: { id },
    select: { title: true },
  });

  await prisma.announcement.delete({ where: { id } });

  await recordAudit({
    actor,
    action: "announcement.delete",
    targetType: "announcement",
    targetId: id,
    targetLabel: target?.title,
  });

  revalidateAnnouncements();
  return { ok: true };
}

/**
 * お知らせをメールで送る。
 *
 * `ignorePreference` を立てると、本人が受け取らない設定にしていても送る。
 * 「重要」なお知らせ専用の扱いで、通常のお知らせでは使わない。乱用すると
 * 受信設定が意味を失い、結果として全部が読まれなくなる。
 *
 * 一度に全員へ投げると SMTP 側で弾かれるため、少しずつ送る。人数が
 * 増えたらキューに逃がすべきだが、いまの規模では同期で足りる。
 */
async function notifyMembers(
  announcement: { title: string; body: string; level: string },
  options: { ignorePreference: boolean } = { ignorePreference: false },
) {
  const recipients = await prisma.user.findMany({
    // 停止中や審査待ちには送らない。ここは重要なお知らせでも変えない。
    where: {
      status: ACCOUNT_STATUS.active,
      ...(options.ignorePreference ? {} : { notifyAnnouncements: true }),
    },
    select: { name: true, nickname: true, email: true },
  });

  let mailSent = 0;
  let mailFailed = 0;
  const BATCH = 10;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((recipient) =>
        sendMail(
          buildAnnouncementMail(
            recipient.nickname ?? recipient.name,
            recipient.email,
            announcement,
            { mandatory: options.ignorePreference },
          ),
        ),
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) mailSent += 1;
      else mailFailed += 1;
    }
  }

  if (mailFailed > 0) {
    console.warn(`[HoshID] お知らせメールを ${mailFailed} 件送れませんでした。`);
  }

  return { mailSent, mailFailed };
}

function revalidateAnnouncements() {
  revalidatePath("/lounge/admin/announcements");
  revalidatePath("/lounge/announcements");
  revalidatePath("/lounge");
}
