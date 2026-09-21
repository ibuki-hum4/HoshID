import { prisma } from "@/lib/prisma";

// sharp と Prisma を使うので Node ランタイム固定。
export const runtime = "nodejs";

/**
 * アイコン画像を配信する。
 *
 * 認証を要求していない。`picture` クレームとして RP に渡す URL であり、
 * 認証が要るとアプリ側で表示できないため。URL に含まれる userId は
 * ランダムな文字列で、かつ `sub` として既に RP に渡している値なので、
 * これ自体が新たな秘密の漏洩にはならない。
 *
 * 画像そのものは本人が公開する前提で登録したものだけを置く。
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/avatar/[userId]">,
) {
  const { userId } = await context.params;

  const avatar = await prisma.avatar.findUnique({
    where: { userId },
    select: { data: true, mimeType: true, version: true },
  });

  if (!avatar) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "content-type": avatar.mimeType,
      // URL に version が入るので、内容が変われば URL も変わる。
      // 古い URL の中身は変わらないため強くキャッシュしてよい。
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${avatar.version}"`,
      // 画像として以外に解釈させない。
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
