import { headers } from "next/headers";
import { forbidden } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireApprovedUser, type CurrentUser } from "@/lib/session";

type Permissions = Record<string, string[]>;

/** 権限を持っているかだけを返す。表示の出し分けに使う。 */
export async function hasPermission(permissions: Permissions): Promise<boolean> {
  const result = await auth.api.userHasPermission({
    headers: await headers(),
    body: { permissions },
  });
  return Boolean(result?.success);
}

/**
 * 権限を要求する。持っていなければ 403。
 *
 * ナビゲーションから項目を隠すのは体裁でしかない。実際の防御はここと、
 * 各 Server Action の入口で行う。画面を隠しただけの制御は URL を直接
 * 叩かれた時点で無意味になる。
 */
export async function requirePermission(
  permissions: Permissions,
): Promise<CurrentUser> {
  const user = await requireApprovedUser();

  if (!(await hasPermission(permissions))) {
    forbidden();
  }

  return user;
}

export function requireApplicationPermission(
  action: "list" | "approve" | "reject",
) {
  return requirePermission({ application: [action] });
}

export function requireMemberListPermission() {
  return requirePermission({ user: ["list"] });
}
