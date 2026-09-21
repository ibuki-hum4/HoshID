"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import { avatarUrl, MAX_UPLOAD_BYTES, processAvatar } from "@/lib/avatar";
import { isLinkKind, MAX_LINKS, normalizeUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { revokeDiscordRoleForAccount } from "@/lib/discord-role";
import { removeSocialLink } from "@/lib/social";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function updateProfile(input: {
  nickname: string;
  bio: string;
}): Promise<ActionResult> {
  await requireApprovedUser();

  if (input.nickname.length > 32) {
    return { ok: false, message: "ニックネームは32文字以内にしてください。" };
  }
  if (input.bio.length > 500) {
    return { ok: false, message: "自己紹介は500文字以内にしてください。" };
  }

  await auth.api.updateUser({
    headers: await headers(),
    body: { nickname: input.nickname, bio: input.bio },
  });

  revalidatePath("/lounge/account");
  return { ok: true };
}

export async function saveLinks(
  links: { kind: string; label: string; url: string }[],
): Promise<ActionResult> {
  const user = await requireApprovedUser();

  if (links.length > MAX_LINKS) {
    return { ok: false, message: `リンクは${MAX_LINKS}件までです。` };
  }

  const rows = [];
  for (const [index, link] of links.entries()) {
    const url = normalizeUrl(link.url);
    if (!url) {
      return {
        ok: false,
        message: `${index + 1}番目のリンクの URL が不正です。http:// か https:// で始まる必要があります。`,
      };
    }
    const label = link.label.trim();
    if (!label) {
      return { ok: false, message: `${index + 1}番目のリンクの名前を入力してください。` };
    }
    if (label.length > 40) {
      return { ok: false, message: "リンク名は40文字以内にしてください。" };
    }

    rows.push({
      userId: user.id,
      kind: isLinkKind(link.kind) ? link.kind : "custom",
      label,
      url,
      sortOrder: index,
    });
  }

  // 並べ替えも含めて丸ごと置き換える。件数が少ないので差分を取るより確実。
  await prisma.$transaction([
    prisma.userLink.deleteMany({ where: { userId: user.id } }),
    prisma.userLink.createMany({ data: rows }),
  ]);

  revalidatePath("/lounge/account");
  return { ok: true };
}

export async function revokeConsent(consentId: string): Promise<ActionResult> {
  await requireApprovedUser();

  try {
    await auth.api.deleteOAuthConsent({
      headers: await headers(),
      body: { id: consentId },
    });
  } catch {
    return { ok: false, message: "解除できませんでした。" };
  }

  revalidatePath("/lounge/account");
  revalidatePath("/lounge");
  return { ok: true };
}

/**
 * セッションを失効させる。
 *
 * 引数はセッション ID であって**トークンではない**。セッショントークンは
 * Cookie に入っている資格情報そのもので、これをブラウザに配ると XSS や
 * 拡張機能、画面共有から全端末のなりすましが可能になる。画面には ID だけを
 * 渡し、トークンの解決はここで行う。
 */
export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const user = await requireApprovedUser();

  // 自分のセッションであることを必ず確認する。userId で絞らないと、
  // ID を推測されれば他人のセッションを切れてしまう。
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { token: true },
  });

  if (!session) {
    return { ok: false, message: "対象のセッションが見つかりませんでした。" };
  }

  try {
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: session.token },
    });
  } catch {
    return { ok: false, message: "失効できませんでした。" };
  }

  revalidatePath("/lounge/account");
  revalidatePath("/lounge");
  return { ok: true };
}

/** この端末以外のセッションをすべて失効させる。 */
export async function revokeOtherSessions(): Promise<ActionResult> {
  await requireApprovedUser();

  try {
    await auth.api.revokeOtherSessions({ headers: await headers() });
  } catch {
    return { ok: false, message: "失効できませんでした。" };
  }

  revalidatePath("/lounge/account");
  revalidatePath("/lounge");
  return { ok: true };
}

/**
 * アイコンを差し替える。
 *
 * 受け取るのは切り抜き済みの画像。ただしクライアントの結果は信用せず、
 * サーバ側で必ずデコードし直して WebP に書き出す（lib/avatar.ts 参照）。
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await requireApprovedUser();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "画像が選ばれていません。" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "画像が大きすぎます。8MB 以内にしてください。" };
  }

  let processed;
  try {
    processed = await processAvatar(await file.arrayBuffer());
  } catch {
    return { ok: false, message: "画像として読み取れませんでした。" };
  }

  // version が変わると配信 URL も変わるので、古い画像が残り続けない。
  const version = randomUUID().replaceAll("-", "").slice(0, 16);

  await prisma.$transaction([
    prisma.avatar.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        data: processed.data,
        width: processed.width,
        height: processed.height,
        mimeType: processed.mimeType,
        version,
      },
      update: {
        data: processed.data,
        width: processed.width,
        height: processed.height,
        mimeType: processed.mimeType,
        version,
      },
    }),
    // user.image を配信 URL にしておくと、一覧や UserInfo の picture が
    // そのまま動く。
    prisma.user.update({
      where: { id: user.id },
      data: { image: avatarUrl(user.id, version) },
    }),
  ]);

  revalidatePath("/lounge/account");
  revalidatePath("/lounge/members");
  return { ok: true };
}

/** アイコンを削除して既定の表示に戻す。 */
export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireApprovedUser();

  await prisma.$transaction([
    prisma.avatar.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { image: null } }),
  ]);

  revalidatePath("/lounge/account");
  revalidatePath("/lounge/members");
  return { ok: true };
}

/**
 * 外部アカウントの連携を解除する。
 *
 * **必ず本人の連携だけを消す。** id だけで消せる作りにすると、他人の連携を
 * 外せてしまう（`removeSocialLink` が userId で絞っている）。
 */
export async function unlinkSocial(id: string): Promise<ActionResult> {
  const user = await requireApprovedUser();

  // 外す前に、その Discord アカウントのロールを落とす。消した後では
  // どのアカウントだったか分からない。
  const link = await prisma.socialLink.findFirst({
    where: { id, userId: user.id },
    select: { provider: true, providerAccountId: true },
  });

  if (link?.provider === "discord") {
    await revokeDiscordRoleForAccount(link.providerAccountId);
  }

  await removeSocialLink(user.id, id);

  revalidatePath("/lounge/account");
  revalidatePath(`/lounge/members/${user.id}`);
  return { ok: true };
}

/**
 * GitHub の草をプロフィールに出すかどうか。
 *
 * 既定は出さない。出すかどうかは本人が選ぶ。
 */
export async function setShowContributions(
  id: string,
  show: boolean,
): Promise<ActionResult> {
  const user = await requireApprovedUser();

  // 自分の連携だけを対象にする。updateMany なら、他人の id を渡されても
  // 0件更新で終わる。
  await prisma.socialLink.updateMany({
    where: { id, userId: user.id, provider: "github" },
    data: { showContributions: show },
  });

  revalidatePath("/lounge/account");
  revalidatePath(`/lounge/members/${user.id}`);
  return { ok: true };
}
