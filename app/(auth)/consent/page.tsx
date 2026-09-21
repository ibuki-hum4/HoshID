import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

import { ConsentForm } from "./consent-form";

export const metadata = { title: "アクセスの許可" };

export default async function ConsentPage(props: PageProps<"/consent">) {
  const params = await props.searchParams;
  const clientId = Array.isArray(params.client_id)
    ? params.client_id[0]
    : params.client_id;

  if (!clientId) {
    return (
      <Suspense>
        <ConsentForm client={null} />
      </Suspense>
    );
  }

  // 同意画面に出す情報はサーバ側で引く。公開エンドポイント経由だと
  // リダイレクト先や所有者まで取れず、利用者が判断する材料が足りない。
  const [client, session] = await Promise.all([
    prisma.oauthClient.findUnique({
      where: { clientId },
      select: {
        clientId: true,
        name: true,
        icon: true,
        uri: true,
        redirectUris: true,
        createdAt: true,
        user: { select: { name: true, nickname: true } },
      },
    }),
    getCurrentSession(),
  ]);

  const [trust, priorConsent] = await Promise.all([
    prisma.oauthClientTrust.findUnique({
      where: { clientId },
      select: { verified: true },
    }),
    session
      ? prisma.oauthConsent.findFirst({
          where: { clientId, userId: session.user.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <Suspense>
      <ConsentForm
        client={
          client
            ? {
                clientId: client.clientId,
                name: client.name ?? null,
                logoUri: client.icon ?? null,
                clientUri: client.uri ?? null,
                // 利用者が「どこへ送られるのか」を判断できるようにする。
                redirectHosts: uniqueHosts(client.redirectUris ?? []),
                ownerName: client.user
                  ? (client.user.nickname ?? client.user.name)
                  : null,
                verified: trust?.verified ?? false,
                registeredAt: client.createdAt?.toISOString() ?? null,
                firstTime: priorConsent === null,
              }
            : null
        }
      />
    </Suspense>
  );
}

function uniqueHosts(uris: string[]): string[] {
  const hosts = new Set<string>();
  for (const uri of uris) {
    try {
      hosts.add(new URL(uri).host);
    } catch {
      // 登録時に検証済みなので通常は起きない。表示できないものは出さない。
    }
  }
  return [...hosts];
}
