import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

import { AppList } from "./app-list";
import { CreateAppForm } from "./create-app-form";

export const metadata = { title: "アプリ" };

export default async function AppsPage() {
  await requireApprovedUser();

  const clients = await auth.api
    .getOAuthClients({ headers: await headers() })
    .catch(() => [])
    .then((list) => list ?? []);

  // 他人のアプリまで見られるのは admin だけ。役員は申請の審査はできるが、
  // ここは見ない。
  const canListAll = await hasPermission({ oauthClient: ["list-all"] });

  const trusts = canListAll
    ? await prisma.oauthClientTrust.findMany({ select: { clientId: true, verified: true } })
    : [];
  const verifiedIds = new Set(
    trusts.filter((trust) => trust.verified).map((trust) => trust.clientId),
  );

  const allClients = canListAll
    ? await prisma.oauthClient.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          clientId: true,
          name: true,
          redirectUris: true,
          scopes: true,
          tokenEndpointAuthMethod: true,
          requirePKCE: true,
          disabled: true,
          userId: true,
          user: { select: { name: true, nickname: true, email: true } },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1>アプリ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          HoshID でログインできるアプリを登録します。承認は不要で、すぐに使えます。
        </p>
      </div>

      <CreateAppForm />

      <AppList
        title="自分のアプリ"
        emptyMessage="まだアプリを登録していません。"
        clients={clients.map((client) => ({
          clientId: client.client_id,
          clientName: client.client_name ?? null,
          redirectUris: client.redirect_uris ?? [],
          scope: client.scope ?? "",
          isPublic: client.token_endpoint_auth_method === "none",
          requirePkce: client.require_pkce ?? true,
          disabled: client.disabled ?? false,
          owner: null,
          verified: null,
        }))}
      />

      {canListAll ? (
        <AppList
          title="すべてのアプリ（管理者）"
          description="HoshID に登録されている全てのアプリです。"
          emptyMessage="登録されているアプリはありません。"
          deletable={false}
          clients={allClients.map((client) => ({
            clientId: client.clientId,
            clientName: client.name ?? null,
            redirectUris: client.redirectUris ?? [],
            scope: (client.scopes ?? []).join(" "),
            isPublic: client.tokenEndpointAuthMethod === "none",
            requirePkce: client.requirePKCE ?? true,
            disabled: client.disabled ?? false,
            owner: client.user
              ? (client.user.nickname ?? client.user.name ?? client.user.email)
              : client.userId
                ? "(不明な所有者)"
                : "(所有者なし)",
            verified: verifiedIds.has(client.clientId),
          }))}
        />
      ) : null}
    </div>
  );
}
