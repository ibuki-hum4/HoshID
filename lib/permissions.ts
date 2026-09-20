import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";

/**
 * 権限の宣言。`defaultStatements` は admin プラグインが持つ user / session の
 * 操作で、そこに HoshID 固有のアカウント申請の操作を足している。
 */
export const statement = {
  ...defaultStatements,
  application: ["list", "approve", "reject"],
} as const;

export const ac = createAccessControl(statement);

/** 一般利用者。管理操作は一切持たない。 */
export const user = ac.newRole({
  ...userAc.statements,
  application: [],
});

/**
 * 役員。アカウント申請の審査はできるが、ユーザーの削除やロール変更はできない。
 * 「承認する権限」と「他人を管理者に昇格させる権限」を分けるためのロール。
 */
export const officer = ac.newRole({
  user: ["list", "get"],
  session: [],
  application: ["list", "approve", "reject"],
});

/** 最高権限。 */
export const admin = ac.newRole({
  ...adminAc.statements,
  application: ["list", "approve", "reject"],
});

export const roles = { user, officer, admin };

export type RoleName = keyof typeof roles;

/** 申請を審査できるロール。UI ではなくサーバ側の判定に使う。 */
export const REVIEWER_ROLES: readonly RoleName[] = ["admin", "officer"];
