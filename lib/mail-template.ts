/**
 * メール本文の組み立て。
 *
 * メールクライアントは CSS の対応がばらばらなので、table レイアウトと
 * インラインスタイルで書く。外部スタイルシートも flex も使わない。
 */

/**
 * HTML に埋め込む前に必ず通す。
 *
 * 名前や却下理由は利用者が入力した値なので、そのまま差し込むとメールの
 * 見た目を壊されたり、偽のリンクを紛れ込ませられたりする。
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type EmailBlock =
  | { type: "paragraph"; text: string }
  | { type: "note"; text: string }
  | { type: "button"; label: string; url: string };

export function renderEmail(input: {
  title: string;
  heading: string;
  greeting: string;
  blocks: EmailBlock[];
  footer: string;
}): string {
  const body = input.blocks.map(renderBlock).join("\n");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
            <tr>
              <td style="padding:28px 28px 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;">
                <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#71717a;">HoshID</p>
                <h1 style="margin:12px 0 0 0;font-size:20px;line-height:1.5;color:#18181b;">${escapeHtml(input.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;font-size:14px;line-height:1.8;color:#3f3f46;">
                <p style="margin:0 0 16px 0;">${escapeHtml(input.greeting)}</p>
${body}
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:16px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;font-size:12px;line-height:1.7;color:#a1a1aa;">
                ${escapeHtml(input.footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "paragraph":
      return `                <p style="margin:0 0 16px 0;">${escapeHtml(block.text).replaceAll("\n", "<br />")}</p>`;

    case "note":
      // 却下理由など、本文と区別して見せたいもの。
      return `                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
                  <tr>
                    <td style="background-color:#f4f4f5;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.8;color:#3f3f46;">${escapeHtml(block.text).replaceAll("\n", "<br />")}</td>
                  </tr>
                </table>`;

    case "button":
      // 一部のクライアントは背景色付きの a を潰すので、table で囲む。
      return `                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;">
                  <tr>
                    <td style="background-color:#18181b;border-radius:9999px;">
                      <a href="${escapeHtml(block.url)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(block.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0;font-size:12px;color:#a1a1aa;word-break:break-all;">ボタンが使えない場合は次の URL を開いてください。<br />${escapeHtml(block.url)}</p>`;
  }
}

/** HTML と同じ内容をテキストでも用意する。 */
export function renderText(input: {
  greeting: string;
  blocks: EmailBlock[];
  footer: string;
}): string {
  const lines: string[] = [input.greeting, ""];

  for (const block of input.blocks) {
    if (block.type === "button") {
      lines.push(`${block.label}: ${block.url}`, "");
    } else {
      lines.push(block.text, "");
    }
  }

  lines.push(input.footer);
  return lines.join("\n");
}
