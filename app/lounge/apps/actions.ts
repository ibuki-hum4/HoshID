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

/** コンフィデンシャルクライアントのシークレットの送り方。作成後は変更できない。 */
const ALLOWED_AUTH_METHODS = ["client_secret_basic", "client_secret_post"] as const;
export type TokenEndpointAuthMethod = (typeof ALLOWED_AUTH_METHODS)[number];

/** Better Auth が返すエラーから、利用者に見せてよい説明だけを取り出す。 */
function describeError(error: unknown, fallback: string): string {
  const body = (error as { body?: { error_description?: string; message?: string } })
    ?.body;
  return body?.error_description ?? body?.message ?? fallback;
}

/**
 * 入力されたリダイレクト URI を整え、application_type を決める。作成と編集で共有する。
 *
 * https のみ・http は localhost のみ、といった判定そのものは Better Auth が
 * application_type に応じて行う。ここで application_type を決め損なうと、
 * 正しい URI まで弾かれる。
 */
function resolveRedirectUris(
  input: string[],
):
  | { ok: true; redirectUris: string[]; applicationType: "native" | "web" }
  | { ok: false; message: string } {
  const redirectUris = input.map((uri) => uri.trim()).filter(Boolean);
  if (redirectUris.length === 0) {
    return { ok: false, message: "リダイレクト URI を1つ以上入力してください。" };
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

  return { ok: true, redirectUris, applicationType: isLoopback ? "native" : "web" };
}

/**
 * ログアウト後の戻り先を整える。0件でもよい（その場合はログアウト完了画面が出る）。
 *
 * Better Auth はこれに SafeUrlSchema しか当てず、独自スキームまで通す。
 * リダイレクト URI と同じ規則（公開ホストは https、http はループバックのみ）を
 * こちらで課す。
 */
function resolvePostLogoutRedirectUris(
  input: string[],
): { ok: true; uris: string[] } | { ok: false; message: string } {
  const uris = input.map((uri) => uri.trim()).filter(Boolean);

  for (const uri of uris) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return { ok: false, message: `ログアウト後の戻り先が URL として読めません: ${uri}` };
    }
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    const allowed =
      !uri.includes("#") &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ? !isLoopback : url.protocol === "http:" && isLoopback);
    if (!allowed) {
      return {
        ok: false,
        message: `ログアウト後の戻り先は、公開ホストの https か localhost の http にしてください: ${uri}`,
      };
    }
  }

  return { ok: true, uris };
}

export async function createApp(input: {
  clientName: string;
  redirectUris: string[];
  scopes: string[];
  publicClient: boolean;
  /** publicClient が false のときだけ使う。true なら "none" 固定。 */
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  /** false にすると PKCE 無しでも認可を通す。旧式アプリ向けの逃げ道。 */
  requirePkce: boolean;
  /** サーバ間通信用。利用者の同意を挟まずにトークンを取れる。 */
  clientCredentials: boolean;
  /** 機器（CLI・テレビ）向けの Device Code。 */
  deviceCode: boolean;
  /** RP からのログアウト要求を受け付ける。 */
  endSession: boolean;
  /** endSession が true のときだけ使う。完全一致した場合だけ戻す。 */
  postLogoutRedirectUris: string[];
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

  const resolved = resolveRedirectUris(input.redirectUris);
  if (!resolved.ok) {
    return resolved;
  }

  const scopes = input.scopes.filter((scope) =>
    (ALLOWED_SCOPES as readonly string[]).includes(scope),
  );
  if (!scopes.includes("openid")) {
    return { ok: false, message: "openid は必須です。" };
  }

  if (
    !input.publicClient &&
    !(ALLOWED_AUTH_METHODS as readonly string[]).includes(input.tokenEndpointAuthMethod)
  ) {
    return { ok: false, message: "シークレットの送り方を選んでください。" };
  }

  const postLogout = resolvePostLogoutRedirectUris(
    input.endSession ? input.postLogoutRedirectUris : [],
  );
  if (!postLogout.ok) {
    return postLogout;
  }

  try {
    const client = await auth.api.createOAuthClient({
      headers: await headers(),
      body: {
        client_name: clientName,
        redirect_uris: resolved.redirectUris,
        scope: scopes.join(" "),
        application_type: resolved.applicationType,
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
        token_endpoint_auth_method: input.publicClient
          ? "none"
          : input.tokenEndpointAuthMethod,
        ...(input.clientUri ? { client_uri: input.clientUri } : {}),
        // Better Auth は空配列を受け付けない（min(1)）。
        ...(postLogout.uris.length > 0
          ? { post_logout_redirect_uris: postLogout.uris }
          : {}),
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
 * シークレットを作り直す。旧シークレットは即座に使えなくなる。
 * 所有者の確認は Better Auth が行う（他人のアプリは UNAUTHORIZED）。
 */
export async function rotateAppSecret(
  clientId: string,
): Promise<{ ok: true; clientSecret: string } | { ok: false; message: string }> {
  const actor = await requireApprovedUser();

  let clientSecret: string | undefined;
  let clientName: string | undefined;
  try {
    const client = await auth.api.rotateClientSecret({
      headers: await headers(),
      body: { client_id: clientId },
    });
    clientSecret = client.client_secret;
    clientName = client.client_name;
  } catch (error) {
    return { ok: false, message: describeError(error, "再発行できませんでした。") };
  }

  if (!clientSecret) {
    return { ok: false, message: "再発行できませんでした。" };
  }

  // シークレット本体は記録しない。
  await recordAudit({
    actor,
    action: "client.rotate-secret",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: clientName ?? clientId,
  });

  return { ok: true, clientSecret };
}

/**
 * 戻り先（リダイレクト URI・アプリからのログアウト・ログアウト後の戻り先）を
 * 差し替える。検証は作成時と同じ。
 */
export async function updateRedirectUris(
  clientId: string,
  input: {
    redirectUris: string[];
    endSession: boolean;
    /** endSession が false のときは無視し、登録済みの値はそのまま残す。 */
    postLogoutRedirectUris: string[];
  },
): Promise<SimpleResult> {
  const actor = await requireApprovedUser();

  const resolved = resolveRedirectUris(input.redirectUris);
  if (!resolved.ok) {
    return resolved;
  }

  const postLogout = input.endSession
    ? resolvePostLogoutRedirectUris(input.postLogoutRedirectUris)
    : null;
  if (postLogout && !postLogout.ok) {
    return postLogout;
  }

  // 監査ログに変更前を残すため、更新の前に読む。
  const before = await prisma.oauthClient.findFirst({
    where: { clientId, userId: actor.id },
    select: {
      name: true,
      redirectUris: true,
      enableEndSession: true,
      postLogoutRedirectUris: true,
    },
  });
  if (!before) {
    return { ok: false, message: "対象のアプリが見つかりませんでした。" };
  }

  try {
    await auth.api.updateOAuthClient({
      headers: await headers(),
      body: {
        client_id: clientId,
        update: {
          redirect_uris: resolved.redirectUris,
          // 作成時の値のままだと、Web アプリに localhost を足しただけで弾かれる。
          application_type: resolved.applicationType,
          ...(postLogout && postLogout.uris.length > 0
            ? { post_logout_redirect_uris: postLogout.uris }
            : {}),
        },
      },
    });
  } catch (error) {
    return { ok: false, message: describeError(error, "変更できませんでした。") };
  }

  // 利用者向けの更新 API では変えられない項目を、所有者本人のレコードにだけ
  // 書き込む。enable_end_session は更新項目に無く、戻り先は空配列を受け付けない。
  await prisma.oauthClient.updateMany({
    where: { clientId, userId: actor.id },
    data: {
      enableEndSession: input.endSession,
      ...(postLogout && postLogout.uris.length === 0 ? { postLogoutRedirectUris: [] } : {}),
    },
  });

  // URI は秘密ではない。乗っ取られて書き換えられたときに辿れるよう、前後を残す。
  const afterPostLogout = postLogout ? postLogout.uris : before.postLogoutRedirectUris;
  await recordAudit({
    actor,
    action: "client.update-redirect-uris",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: before.name ?? clientId,
    detail: [
      `リダイレクト URI: ${before.redirectUris.join(" ")} → ${resolved.redirectUris.join(" ")}`,
      `アプリからのログアウト: ${before.enableEndSession ? "ON" : "OFF"} → ${input.endSession ? "ON" : "OFF"}`,
      `ログアウト後の戻り先: ${before.postLogoutRedirectUris.join(" ") || "(なし)"} → ${afterPostLogout.join(" ") || "(なし)"}`,
    ].join(" / "),
  });

  revalidatePath("/lounge/apps");
  return { ok: true };
}

/**
 * 所有者がアプリを一時停止・再開する。
 *
 * Better Auth には disabled を変える API が無い（adminUpdateOAuthClient の
 * 更新項目にも含まれない）ので、所有者本人のレコードだけを直接更新する。
 * **管理者が止めたアプリは再開させない。** 不正なアプリを止めても本人が
 * すぐ戻せるのでは意味がない。
 */
export async function setAppDisabled(
  clientId: string,
  disabled: boolean,
): Promise<SimpleResult> {
  const actor = await requireApprovedUser();

  const client = await prisma.oauthClient.findFirst({
    where: { clientId, userId: actor.id },
    select: { name: true },
  });
  if (!client) {
    return { ok: false, message: "対象のアプリが見つかりませんでした。" };
  }

  if (!disabled) {
    const trust = await prisma.oauthClientTrust.findUnique({
      where: { clientId },
      select: { adminDisabled: true },
    });
    if (trust?.adminDisabled) {
      return {
        ok: false,
        message: "管理者が停止しているため再開できません。管理者に問い合わせてください。",
      };
    }
  }

  await prisma.oauthClient.updateMany({
    where: { clientId, userId: actor.id },
    data: { disabled },
  });

  await recordAudit({
    actor,
    action: disabled ? "client.disable" : "client.enable",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: client.name ?? clientId,
  });

  revalidatePath("/lounge/apps");
  return { ok: true };
}

/**
 * 管理者がアプリを停止・再開する。他人のアプリにも効く。
 *
 * 止めている間は adminDisabled の印を立て、所有者が自分で再開できないようにする。
 * 解除すると停止そのものも解く。
 */
export async function setClientAdminDisabled(
  clientId: string,
  disabled: boolean,
): Promise<SimpleResult> {
  const actor = await requirePermission({ oauthClient: ["list-all"] });

  const client = await prisma.oauthClient.findUnique({
    where: { clientId },
    select: { name: true },
  });
  if (!client) {
    return { ok: false, message: "対象のアプリが見つかりませんでした。" };
  }

  const mark = {
    adminDisabled: disabled,
    adminDisabledBy: disabled ? actor.id : null,
    adminDisabledAt: disabled ? new Date() : null,
  };

  await prisma.$transaction([
    prisma.oauthClientTrust.upsert({
      where: { clientId },
      create: { clientId, ...mark },
      update: mark,
    }),
    prisma.oauthClient.update({
      where: { clientId },
      data: { disabled },
    }),
  ]);

  await recordAudit({
    actor,
    action: disabled ? "client.disable" : "client.enable",
    targetType: "oauthClient",
    targetId: clientId,
    targetLabel: client.name ?? clientId,
    detail: disabled ? "管理者による停止（所有者は再開できない）" : "管理者による停止を解除",
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
