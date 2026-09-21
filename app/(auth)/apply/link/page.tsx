import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readApplicationTicket } from "@/lib/application-ticket";
import { prisma } from "@/lib/prisma";
import { isSocialConfigured } from "@/lib/social";
import { SOCIAL_PROVIDER_META } from "@/lib/social-providers";

import { APPLICATION_COOKIE } from "../constants";
import { ApplicationLinkStep } from "./link-step";

export const metadata = { title: "アカウントの連携" };

/**
 * 申請の2段目。外部サービスとの連携を求める。
 *
 * まだセッションは持てない（`prepared` はログインできない）ので、申請時に
 * 渡したチケットで「どの申請の話か」を決める。チケットが無い・切れている
 * 場合は申請からやり直してもらう。
 *
 * **連携は必須にしていない。** 飛ばした申請は審査画面で ✕ として見えるので、
 * 承認するかどうかは管理者が判断できる。ここで強制すると、Discord を持って
 * いない人が申請そのものをできなくなる。
 */
export default async function ApplyLinkPage(
  props: PageProps<"/apply/link">,
) {
  const ticket = (await cookies()).get(APPLICATION_COOKIE)?.value;
  const userId = ticket ? await readApplicationTicket(ticket) : null;

  if (!userId) {
    redirect("/apply");
  }

  const params = await props.searchParams;
  const linkResult = typeof params.link === "string" ? params.link : null;

  // Discord は複数繋げる。繋いだ順に並べる。
  const linked = await prisma.socialLink.findMany({
    where: { userId, provider: "discord" },
    orderBy: { linkedAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      inGuild: true,
    },
  });

  return (
    <ApplicationLinkStep
      configured={isSocialConfigured("discord")}
      purpose={SOCIAL_PROVIDER_META.discord.purpose}
      linked={linked}
      inviteUrl={process.env.DISCORD_GUILD_INVITE_URL ?? null}
      linkResult={linkResult}
    />
  );
}
