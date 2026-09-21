/**
 * お問い合わせの種別。
 *
 * **`"use server"` のファイルに置かないこと。** Server Actions のモジュールは
 * 非同期関数しかエクスポートできず、定数を置くとクライアント側で空になる。
 * 実際に一度そうなって、種別の選択肢が消えた。
 */
export const REPORT_CATEGORIES = {
  bug: "不具合の報告",
  question: "使い方の質問",
  account: "アカウントについて",
  other: "その他",
} as const;

export type ReportCategory = keyof typeof REPORT_CATEGORIES;

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === "string" && value in REPORT_CATEGORIES;
}

export const REPORT_MAX_BODY = 2000;
