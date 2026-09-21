import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildAuthorizeUrl,
  encodeLinkState,
  isSocialConfigured,
  safeReturnTo,
} from "@/lib/social";
import { isSocialProvider } from "@/lib/social-providers";
import { getCurrentSession } from "@/lib/session";

import { APPLICATION_COOKIE } from "@/app/(auth)/apply/constants";
import { readApplicationTicket } from "@/lib/application-ticket";

export const LINK_NONCE_COOKIE = "hoshid_link_nonce";

/**
 * 外部サービスとの連携を始める。
 *
 * 連携先の利用者は2通りの決まり方をする。
 *
 *   1. ログイン中のセッション（アカウント設定からの連携）
 *   2. 申請に紐づく署名付きチケット（申請の途中。まだセッションを持てない）
 *
 * **どちらも無ければ何もしない。** クエリの userId を信じる作りにすると、
 * 誰でも他人のアカウントに自分の Discord を繋げられる。
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/link/[provider]/start">,
) {
  const { provider } = await context.params;

  if (!isSocialProvider(provider) || !isSocialConfigured(provider)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 404 });
  }

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", url.origin));
  }

  // state と対にして Cookie に置く。state だけでも userId に縛られている
  // ため詐称はできないが、往復の対応づけはここで確かめる。
  const nonce = randomBytes(16).toString("base64url");
  const state = await encodeLinkState({ provider, userId, nonce, returnTo });

  const authorizeUrl = buildAuthorizeUrl(provider, state);
  if (!authorizeUrl) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 404 });
  }

  const response = NextResponse.redirect(authorizeUrl);
  (await cookies()).set(LINK_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}

async function resolveUserId(): Promise<string | null> {
  const session = await getCurrentSession().catch(() => null);
  if (session?.user?.id) return session.user.id;

  // 申請の途中。セッションはまだ作れないので、申請時に渡したチケットで
  // 識別する。**チケットは Cookie からしか読まない。** クエリで受け取ると、
  // 他人に踏ませた URL で連携先をすり替えられる。
  const ticket = (await cookies()).get(APPLICATION_COOKIE)?.value;
  return ticket ? readApplicationTicket(ticket) : null;
}
