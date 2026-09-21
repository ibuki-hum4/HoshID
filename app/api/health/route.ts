import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * 死活監視。k8s の probe が叩く。
 *
 * **認証のエンドポイントを probe に使わない。** discovery や JWKS を叩くと、
 * 監視のたびに鍵を読むうえ、レート制限の対象にもなる。
 *
 * DB まで確かめるのは readiness の観点から。DB が落ちている Pod に振られても
 * 全部 500 になるだけなので、外してもらった方がよい。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
