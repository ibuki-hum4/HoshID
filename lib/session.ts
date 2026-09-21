import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { canSignIn } from "@/lib/account-status";
import { auth } from "@/lib/auth";
import { REVIEWER_ROLES, type RoleName } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  status?: string;
  twoFactorEnabled?: boolean | null;
  notifyAnnouncements?: boolean | null;
  nickname?: string | null;
  bio?: string | null;
};

/** 現在のセッション。未ログインなら null。 */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * ログイン済みかつ承認済みであることを要求する。
 *
 * 未承認ユーザーはそもそもセッションを持てない（auth.ts の
 * databaseHooks.session.create.before で弾いている）が、承認後に却下へ
 * 変わった場合に既存セッションが生き残るため、ここでも確認する。
 */
export async function requireApprovedUser(): Promise<CurrentUser> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const user = session.user as CurrentUser;

  if (!canSignIn(user.status)) {
    redirect("/pending");
  }

  return user;
}

/** 申請を審査できるロールかどうか。表示の出し分けにのみ使う。 */
export function canReviewApplications(role: string | null | undefined): boolean {
  return REVIEWER_ROLES.includes(role as RoleName);
}
