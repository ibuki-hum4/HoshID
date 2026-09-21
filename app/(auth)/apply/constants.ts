/**
 * 申請フローの定数。
 *
 * **`"use server"` のファイルに定数を置かないこと。** あちらは非同期関数しか
 * export できず、定数は空になってクライアント側で静かに壊れる（過去に
 * REPORT_CATEGORIES で踏んでいる）。
 */

/** 申請中の本人を指すチケットを入れる Cookie。 */
export const APPLICATION_COOKIE = "hoshid_application";
