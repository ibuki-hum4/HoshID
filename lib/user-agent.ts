/**
 * User-Agent を人が読める短い名前にする。
 *
 * 端末一覧に生の UA を並べると長すぎて、どれが自分の端末か分からなくなる。
 * 正確な判定は目的ではないので、よくあるものだけを拾って残りは素直に
 * 「不明な端末」と出す。
 */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "不明な端末";

  // 自前のスクリプトや CLI。開発中はこれが大量に増える。
  if (/^Bun\//i.test(userAgent)) return "Bun スクリプト";
  if (/^node/i.test(userAgent) || /undici/i.test(userAgent)) return "Node スクリプト";
  if (/^curl\//i.test(userAgent)) return "curl";

  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);

  if (!browser && !platform) return "不明な端末";
  if (!platform) return browser ?? "不明な端末";
  if (!browser) return platform;
  return `${browser}（${platform}）`;
}

function detectBrowser(ua: string): string | null {
  // Edge と Chrome は互いの名前を含むので、狭いものから順に見る。
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function detectPlatform(ua: string): string | null {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

/** 一覧で補助的に出す、生の UA を短く切ったもの。 */
export function shortenUserAgent(userAgent: string | null, max = 72): string | null {
  if (!userAgent) return null;
  return userAgent.length > max ? `${userAgent.slice(0, max)}…` : userAgent;
}

/** ループバックや未記録の IP を分かりやすく言い換える。 */
export function describeIpAddress(ip: string | null): string {
  if (!ip) return "IP 記録なし";
  if (ip === "::1" || ip === "127.0.0.1" || /^0{4}(:0{4}){7}$/.test(ip)) {
    return "ローカル";
  }
  return ip;
}
