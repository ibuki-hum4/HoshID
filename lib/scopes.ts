/**
 * 同意画面に出すスコープの説明。
 *
 * ここに無いスコープが要求された場合は、識別子をそのまま出すのではなく
 * 「不明な権限」として目立たせる。ユーザーが内容を理解できないまま同意
 * させないため。
 */
export type ScopeDescription = {
  /** 同意画面に出す短い見出し。 */
  title: string;
  /** 何が相手に渡るのかを具体的に書く。 */
  detail: string;
  /** 外せないスコープかどうか。openid は OIDC の前提なので外せない。 */
  required?: boolean;
};

export const SCOPE_DESCRIPTIONS: Record<string, ScopeDescription> = {
  openid: {
    title: "あなたを識別する",
    detail: "あなたのアカウントを表す ID が渡されます。",
    required: true,
  },
  profile: {
    title: "プロフィール",
    detail: "表示名とアイコン画像が渡されます。",
  },
  email: {
    title: "メールアドレス",
    detail: "メールアドレスと、確認済みかどうかが渡されます。",
  },
  offline_access: {
    title: "継続的なアクセス",
    detail:
      "あなたがログインしていない間も、アプリがアクセスを更新できるようになります。",
  },
};

export function describeScope(scope: string): ScopeDescription {
  return (
    SCOPE_DESCRIPTIONS[scope] ?? {
      title: scope,
      detail: "このアプリが要求している権限です。内容が不明な場合は許可しないでください。",
    }
  );
}

export function isKnownScope(scope: string): boolean {
  return scope in SCOPE_DESCRIPTIONS;
}

/** クエリの `scope` を配列にする。重複と空要素は落とす。 */
export function parseScopes(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return [...new Set(scope.split(/\s+/).filter(Boolean))];
}
