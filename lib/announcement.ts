export const ANNOUNCEMENT_LEVELS = {
  info: "お知らせ",
  warning: "注意",
  critical: "重要",
} as const;

export type AnnouncementLevel = keyof typeof ANNOUNCEMENT_LEVELS;

export function isAnnouncementLevel(value: unknown): value is AnnouncementLevel {
  return typeof value === "string" && value in ANNOUNCEMENT_LEVELS;
}

/** 表示の強さ。重要なものだけを目立たせ、普段のお知らせは静かに出す。 */
export function announcementVariant(
  level: AnnouncementLevel,
): "secondary" | "default" | "destructive" {
  switch (level) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    default:
      return "secondary";
  }
}

export const ANNOUNCEMENT_MAX_TITLE = 120;
export const ANNOUNCEMENT_MAX_BODY = 4000;

/**
 * ダッシュボードの抜粋用に、Markdown の記号を落とした素のテキストを作る。
 *
 * 2 行に切り詰めた中に `##` や `**` が混ざると読みにくい。完全な変換は
 * 目的ではないので、見出し・強調・リンク・コードの記号だけを外す。
 */
export function toPlainExcerpt(markdown: string, max = 160): string {
  const text = markdown
    // コードブロックは中身ごと落とす
    .replace(/```[\s\S]*?```/g, " ")
    // 見出し・引用・箇条書きの行頭記号
    .replace(/^\s{0,3}(#{1,6}|>|[-*+])\s+/gm, "")
    // リンクは表示文字だけ残す
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    // 強調とインラインコード
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > max ? `${text.slice(0, max)}…` : text;
}
