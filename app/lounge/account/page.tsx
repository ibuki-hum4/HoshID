import { headers } from "next/headers";

import {
  SlidingTabs,
  SlidingTabsContent,
  SlidingTabsList,
  SlidingTabsTrigger,
} from "@/components/sliding-tabs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  describeIpAddress,
  describeUserAgent,
  shortenUserAgent,
} from "@/lib/user-agent";
import { requireApprovedUser } from "@/lib/session";
import { isSocialConfigured } from "@/lib/social";
import {
  SOCIAL_PROVIDERS,
  isSocialProvider,
  type SocialProvider,
} from "@/lib/social-providers";

import { AvatarEditor } from "./avatar-editor";
import { ConnectedApps } from "./connected-apps";
import { PasskeySection } from "./passkey-section";
import { TwoFactorSection } from "./two-factor-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { SocialSection } from "./social-section";

export const metadata = { title: "アカウントセンター" };

export default async function AccountPage(props: PageProps<"/lounge/account">) {
  const user = await requireApprovedUser();
  const params = await props.searchParams;
  const linkResult = typeof params.link === "string" ? params.link : null;
  const requestHeaders = await headers();

  const currentSession = await auth.api.getSession({ headers: requestHeaders });

  const [links, socialLinks, consents, sessions, passkeys] = await Promise.all([
    prisma.userLink.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.socialLink.findMany({
      where: { userId: user.id },
      orderBy: [{ provider: "asc" }, { linkedAt: "asc" }],
    }),
    auth.api.getOAuthConsents({ headers: requestHeaders }).catch(() => []),
    auth.api.listSessions({ headers: requestHeaders }).catch(() => []),
    prisma.passkey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1>アカウントセンター</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          プロフィールとセキュリティ、連携中のアプリを管理します。
        </p>
      </div>

      <SlidingTabs defaultValue="profile">
        <SlidingTabsList>
          <SlidingTabsTrigger value="profile">
            プロフィール
          </SlidingTabsTrigger>
          <SlidingTabsTrigger value="security">
            セキュリティ
          </SlidingTabsTrigger>
          <SlidingTabsTrigger value="apps">
            連携アプリ
          </SlidingTabsTrigger>
        </SlidingTabsList>

        <SlidingTabsContent value="profile" className="mt-6 space-y-4">
          <AvatarEditor
            displayName={user.nickname || user.name}
            image={user.image ?? null}
          />
          <ProfileSection
            nickname={user.nickname ?? ""}
            bio={user.bio ?? ""}
            name={user.name}
            email={user.email}
            links={links.map((link) => ({
              kind: link.kind,
              label: link.label,
              url: link.url,
            }))}
          />
          <SocialSection
            links={socialLinks
              .filter((link) => isSocialProvider(link.provider))
              .map((link) => ({
                id: link.id,
                provider: link.provider as SocialProvider,
                username: link.username,
                displayName: link.displayName,
                avatarUrl: link.avatarUrl,
                profileUrl: link.profileUrl,
                showContributions: link.showContributions,
                inGuild: link.inGuild,
              }))}
            available={SOCIAL_PROVIDERS.filter((provider) => isSocialConfigured(provider))}
            linkResult={linkResult}
          />
        </SlidingTabsContent>

        <SlidingTabsContent value="security" className="mt-6 space-y-4">
          <TwoFactorSection enabled={user.twoFactorEnabled === true} />
          <PasskeySection
            passkeys={passkeys.map((passkey) => ({
              id: passkey.id,
              name: passkey.name,
              deviceType: passkey.deviceType,
              backedUp: passkey.backedUp,
              createdAt: passkey.createdAt?.toISOString() ?? null,
            }))}
          />
          <SecuritySection
            sessions={[...sessions]
              // 自分の端末を先頭に、あとは新しい順。古いものを延々と
              // 探させない。
              .sort((a, b) => {
                if (a.id === currentSession?.session.id) return -1;
                if (b.id === currentSession?.session.id) return 1;
                return b.createdAt.getTime() - a.createdAt.getTime();
              })
              .map((s) => ({
                // トークンは渡さない。ID だけをやり取りする。
                id: s.id,
                isCurrent: s.id === currentSession?.session.id,
                device: describeUserAgent(s.userAgent ?? null),
                rawUserAgent: shortenUserAgent(s.userAgent ?? null),
                ipAddress: describeIpAddress(s.ipAddress ?? null),
                createdAt: s.createdAt.toISOString(),
                expiresAt: s.expiresAt.toISOString(),
              }))}
          />
        </SlidingTabsContent>

        <SlidingTabsContent value="apps" className="mt-6">
          <ConnectedApps
            consents={consents.map((consent) => ({
              id: consent.id,
              clientId: consent.clientId,
              scopes: consent.scopes,
              createdAt: consent.createdAt.toISOString(),
            }))}
          />
        </SlidingTabsContent>
      </SlidingTabs>
    </div>
  );
}
