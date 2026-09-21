export const THEME_STORAGE_KEY = "hoshid.theme";
export const REDUCE_MOTION_STORAGE_KEY = "hoshid.reduceMotion";

/**
 * 保存された表示設定を、描画より前に <html> へ反映する。
 *
 * React の描画を待つと、一瞬だけ OS 設定の見た目が出てから切り替わる
 * （いわゆる FOUC）。ダークにしている人が毎回まぶしい思いをするので先に当てる。
 *
 * **必ず <head> の中に置くこと。** <html> 直下や <body> に置くと、React 19 が
 * 置き場所を決められず "Cannot render a sync or defer <script> outside the main
 * document" を出し続ける。`next/script` の `beforeInteractive` も同じ警告に
 * なるので使わない。
 *
 * `async` を付けて逃げないこと。実行の順序が保証されなくなり、描画より後に
 * 走って FOUC が戻る。
 *
 * localStorage が使えない環境（プライベートウィンドウの制限など）でも
 * 落ちないよう、全体を try で包む。失敗した場合は OS 設定に従う。
 */
const SCRIPT = `
(function () {
  try {
    var root = document.documentElement;

    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (theme === "dark" || theme === "light") {
      root.classList.add(theme);
    }

    if (localStorage.getItem(${JSON.stringify(REDUCE_MOTION_STORAGE_KEY)}) === "true") {
      root.classList.add("reduce-motion");
    }
  } catch (e) {}
})();
`;

export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
