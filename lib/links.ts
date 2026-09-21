/** プロフィールに並べるリンクの種別。 */
export const LINK_KINDS = {
  custom: "リンク",
  x: "X",
  github: "GitHub",
  discord: "Discord",
  youtube: "YouTube",
  bluesky: "Bluesky",
  misskey: "Misskey",
  website: "ウェブサイト",
} as const;

export type LinkKind = keyof typeof LINK_KINDS;

export function isLinkKind(value: unknown): value is LinkKind {
  return typeof value === "string" && value in LINK_KINDS;
}

export const MAX_LINKS = 20;

/**
 * 利用者が入力した URL を検証する。
 *
 * **http と https 以外を通さないこと。** `javascript:` や `data:` を許すと、
 * プロフィールを開いた他人のブラウザで任意のスクリプトが走る。IdP の画面で
 * これが起きるとセッションごと奪われる。
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}
