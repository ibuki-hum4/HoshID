"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authorize";
import { requireApprovedUser } from "@/lib/session";

export type CreateResult =
  | { ok: true; clientId: string; clientSecret: string | null }
  | { ok: false; message: string };

export type SimpleResult = { ok: true } | { ok: false; message: string };

const ALLOWED_SCOPES = ["openid", "profile", "email", "offline_access"] as const;

/** Better Auth が返すエラーから、利用者に見せてよい説明だけを取り出す。 */
function describeError(error: unknown, fallback: string): string {
  const body = (error as { body?: { error_description?: string; message?: string } })
    ?.body;
  return body?.error_description ?? body?.message ?? fallback;
}

export async function createApp(input: {
  clientName: string;
  redirectUris: string[];
  scopes: string[];
  publicClient: boolean;
  /** false にすると PKCE 無しでも認可を通す。旧式アプリ向けの逃げ道。 */
  requirePkce: boolean;
  /** サーバ間通信用。利用者の同意を挟まずにトークンを取れる。 */
  clientCredentials: boolean;
  /** 機器（CLI・テレビ）向けの Device Code。 */
  deviceCode: boolean;
  /** RP からのログアウト要求を受け付ける。 */
  endSession: boolean;
  clientUri?: string;
}): Promise<CreateResult> {
  const user = await requireApprovedUser();

  const clientName = input.clientName.trim();
  if (!clientName) {
    return { ok: false, message: "アプリ名を入力してください。" };
  }
  if (clientName.length > 80) {
    return { ok: false, message: "アプリ名は80文字以内にしてください。" };
  }

  const redirectUris = input.redirectUris.map((uri) => uri.trim()).filter(Boolean);
  if (redirectUris.length === 0) {
    return { ok: false, message: "リダイレクト URI を1つ以上入力してください。" };
  }

  const scopes = input.scopes.filter((scope) =>
    (ALLOWED_SCOPES as readonly string[]).includes(scope),
  );
  if (!scopes.includes("openid")) {
    return { ok: false, message: "openid は必須です。" };
  }

  // ループバックへの http は application_type: "native" でしか許されない。
  // 逆に公開ホストの https は "web" 扱いにしないと弾かれる。
  const isLoopback = redirectUris.every((uri) => {
    try {
      const { hostname, protocol } = new URL(uri);
      return (
        protocol === "http:" &&
        (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]")
      );
    } catch {
      return false;
    }
  });

  try {
    const client = await auth.api.createOAuthClient({
      headers: await headers(),
      body: {
        client_name: clientName,
        redirect_uris: redirectUris,
        scope: scopes.join(" "),
        application_type: isLoopback ? "native" : "web",
        // 使う grant だけを許可する。増やすほど攻撃面が広がる。
        grant_types: [
          "authorization_code",
          ...(scopes.includes("offline_access") ? ["refresh_token"] : []),
          ...(input.clientCredentials ? ["client_credentials"] : []),
          ...(input.deviceCode
            ? ["urn:ietf:params:oauth:grant-type:device_code"]
            : []),
        ],
        ...(input.clientCredentials
          ? { client_credentials_scopes: scopes.filter((s) => s !== "openid") }
          : {}),
        // パブリッククライアントはシークレットを持てない。PKCE だけで守る。
        ...(input.publicClient ? { token_endpoint_auth_method: "none" } : {}),
        ...(input.clientUri ? { client_uri: input.clientUri } : {}),
      },
    });

    // ユーザー向けの作成 API は require_pkce を受け付けないため、作成後に
    // 自分が所有するレコードだけを更新する。
    //
    // パブリッククライアントは対象外。シークレットを持てない以上 PKCE が
    // 唯一の防御で、ライブラリ側も tokenEndpointAuthMethod === "none" の
    // 場合は無条件に必須と判定する。ここで false を書いても意味がない。
    // 利用者向けの作成 API では設定できない項目を、所有者本人のレコードに
    // だけ書き込む。
    if (input.endSession) {
      await prisma.oauthClient.updateMany({
        where: { clientId: client.client_id, userId: user.id },
        data: { enableEndSession: true },
      });
    }

    if (!input.publicClient && !input.requirePkce) {
      await prisma.oauthClient.updateMany({
        where: { clientId: client.client_id, userId: user.id },
        data: { requirePKCE: false },
      });
    }

    revalidatePath("/lounge/apps");

    return {
      ok: true,
      clientId: client.client_id,
      clientSecret: client.client_secret ?? null,
    };
  } catch (error) {
    return { ok: false, message: describeError(error, "アプリを作成できませんでした。") };
  }
}

export async function deleteApp(clientId: string): Promise<SimpleResult> {
  const actor = await requireApprovedUser();

  const target = await prisma.oauthClient.findUnique({
    where: { clientId },
    select: { name: true },
  });

  try {
    await auth.api.deleteOAuthClient({
      headers: await headers(),
      body: { client_id: clientId },
    });
  } catch (error) {
    return { ok: false, message: describeError(error, "削除できませんでした。") };
  }

  await recordAudit({
    actor,
    action: "client.delete",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: target?.name ?? clientId,
  });

  revalidatePath("/lounge/apps");
  return { ok: true };
}

/**
 * アプリを「検証済み」にする。同意画面のバッジと警告の出し分けに使う。
 *
 * 誰でもアプリを登録できる以上、アプリ名は自称でしかない。管理者が実体を
 * 確かめたものだけをこの印で区別する。**利用者が騙されるかどうかが
 * かかっているので、権限を緩めないこと。**
 */
export async function setClientVerified(
  clientId: string,
  verified: boolean,
): Promise<SimpleResult> {
  const actor = await requirePermission({ oauthClient: ["list-all"] });

  const client = await prisma.oauthClient.findUnique({
    where: { clientId },
    select: { clientId: true, name: true },
  });

  if (!client) {
    return { ok: false, message: "対象のアプリが見つかりませんでした。" };
  }

  const clientName = client.name;

  await prisma.oauthClientTrust.upsert({
    where: { clientId },
    create: {
      clientId,
      verified,
      verifiedBy: verified ? actor.id : null,
      verifiedAt: verified ? new Date() : null,
    },
    update: {
      verified,
      verifiedBy: verified ? actor.id : null,
      verifiedAt: verified ? new Date() : null,
    },
  });

  await recordAudit({
    actor,
    action: verified ? "client.verify" : "client.unverify",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: clientName ?? clientId,
  });

  revalidatePath("/lounge/apps");
  return { ok: true };
}
