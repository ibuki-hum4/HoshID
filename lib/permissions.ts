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
  /**
   * 他人が登録した OAuth クライアントまで見られるかどうか。
   * 自分のアプリの閲覧・作成・削除はこの権限とは無関係に誰でもできる。
   */
  oauthClient: ["list-all"],
  /**
   * お知らせの作成・編集・削除。全メンバーの画面に出るものなので
   * 管理者だけに持たせる。役員には渡さない。
   */
  announcement: ["create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

/** 一般利用者。管理操作は一切持たない。 */
export const user = ac.newRole({
  ...userAc.statements,
  application: [],
  oauthClient: [],
  announcement: [],
});

/**
 * 役員。アカウント申請の審査はできるが、ユーザーの削除やロール変更はできない。
 * 「承認する権限」と「他人を管理者に昇格させる権限」を分けるためのロール。
 */
export const officer = ac.newRole({
  user: ["list", "get"],
  session: [],
  application: ["list", "approve", "reject"],
  // 役員は審査のためにメンバーは見られるが、他人のアプリまでは見ない。
  oauthClient: [],
  announcement: [],
});

/** 最高権限。 */
export const admin = ac.newRole({
  ...adminAc.statements,
  application: ["list", "approve", "reject"],
  oauthClient: ["list-all"],
  announcement: ["create", "update", "delete"],
});

export const roles = { user, officer, admin };

export type RoleName = keyof typeof roles;

/** 申請を審査できるロール。UI ではなくサーバ側の判定に使う。 */
export const REVIEWER_ROLES: readonly RoleName[] = ["admin", "officer"];
