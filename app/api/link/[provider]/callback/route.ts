import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  decodeLinkState,
  fetchSocialProfile,
  safeReturnTo,
  saveSocialLink,
} from "@/lib/social";
import { isSocialProvider } from "@/lib/social-providers";
import { recordGuildMembership, syncDiscordRole } from "@/lib/discord-role";

import { LINK_NONCE_COOKIE } from "../start/route";

/**
 * 外部サービスから戻ってくる口。
 *
 * ここで確かめるのは3つ。
 *
 *   1. state を復号できること（＝こちらが発行したものであること）
 *   2. state の中の provider が、いま来ている経路と一致すること
 *   3. state の nonce が、こちらが置いた Cookie と一致すること
 *
 * 連携先の利用者は **state の中の userId** で決める。クエリからは取らない。
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/link/[provider]/callback">,
) {
  const { provider } = await context.params;
  const url = new URL(request.url);

  const back = (params: Record<string, string>, returnTo = "/lounge/account") => {
    const target = new URL(returnTo, url.origin);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(target);
    response.cookies.delete(LINK_NONCE_COOKIE);
    return response;
  };

  if (!isSocialProvider(provider)) {
    return back({ link: "error" });
  }

  const rawState = url.searchParams.get("state");
  const state = rawState ? await decodeLinkState(rawState) : null;

  if (!state || state.provider !== provider) {
    return back({ link: "error" });
  }

  const returnTo = safeReturnTo(state.returnTo);

  const cookieStore = await cookies();
  if (cookieStore.get(LINK_NONCE_COOKIE)?.value !== state.nonce) {
    return back({ link: "error" }, returnTo);
  }

  // 利用者が相手側で拒否した場合。失敗ではないので、そのまま戻す。
  if (url.searchParams.get("error")) {
    return back({ link: "cancelled" }, returnTo);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return back({ link: "error" }, returnTo);
  }

  const profile = await fetchSocialProfile(provider, code).catch(() => null);
  if (!profile) {
    return back({ link: "error" }, returnTo);
  }

  const saved = await saveSocialLink(state.userId, provider, profile);
  if (!saved.ok) {
    return back({ link: saved.reason === "taken" ? "taken" : "error" }, returnTo);
  }

  // 既に利用中の人が後から Discord を繋いだ場合、その場でロールを付ける。
  // 承認のときだけ同期する作りだと、後から繋いだ人に一生付かない。
  //
  // まだ承認されていない申請者の場合はロールが付かないが、**サーバに
  // いるかどうかはここで確かめて残す。** 参加していないことを繋いだ直後に
  // 伝えられないと、承認された後で「ロールが来ない」と悩むことになる。
  if (provider === "discord") {
    await syncDiscordRole(state.userId);
    await recordGuildMembership(profile.providerAccountId);
  }

  return back({ link: "linked", provider }, returnTo);
}
