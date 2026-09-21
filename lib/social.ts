import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

import { resolveSecretConfig } from "@/lib/jwks";
import { prisma } from "@/lib/prisma";
import {
  SOCIAL_PROVIDER_META,
  type Contributions,
  type ContributionDay,
  type SocialProvider,
} from "@/lib/social-providers";

/**
 * 外部サービスとの連携（Discord / GitHub）。
 *
 * **Better Auth の `linkSocial()` は使っていない。** あれはセッションを要求
 * するが、HoshID の申請者はまだ `prepared` でセッションを作れない。ここでは
 * OAuth を自前で往復し、連携先の利用者を「ログイン中のセッション」か
 * 「申請に紐づく署名付きトークン」のどちらからでも決められるようにしている。
 * 使う資格情報は各サービスの開発者ポータルのものでそのまま。
 *
 * サーバ専用。クライアントから読む定数は `lib/social-providers.ts`。
 */

type ProviderConfig = {
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
};

const CONFIG: Record<SocialProvider, ProviderConfig> = {
  discord: {
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    // identify だけ。メールもサーバ一覧も要らない。**必要以上に求めない。**
    scope: "identify",
  },
  github: {
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    // 公開プロフィールのみ。read:user はメールを含まない。
    scope: "read:user",
  },
};

export type SocialProfile = {
  providerAccountId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

function credentials(provider: SocialProvider): { id: string; secret: string } | null {
  const config = CONFIG[provider];
  const id = process.env[config.clientIdEnv];
  const secret = process.env[config.clientSecretEnv];
  if (!id || !secret) return null;
  return { id, secret };
}

/** 資格情報が揃っているか。揃っていないサービスはボタンを出さない。 */
export function isSocialConfigured(provider: SocialProvider): boolean {
  return credentials(provider) !== null;
}

export function redirectUri(provider: SocialProvider): string {
  const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/api/link/${provider}/callback`;
}

// --- state（往復のあいだ預ける値） ------------------------------------------

/**
 * 連携先の利用者と、戻り先を預ける。
 *
 * **暗号化して渡す。** userId が平文で URL に出ると、外部サービスの側や
 * 経路上に利用者の内部 ID を晒すことになる。
 *
 * この値が userId を含んでいることが CSRF への防御でもある。攻撃者が被害者の
 * アカウントに自分の Discord を繋ぐには、被害者向けに発行された state が要る。
 * あわせて nonce を Cookie と突き合わせる。
 */
export type LinkState = {
  provider: SocialProvider;
  userId: string;
  /** Cookie と突き合わせる使い捨ての値。 */
  nonce: string;
  /** 連携が終わったあとに戻す先。アプリ内のパスだけを許す。 */
  returnTo: string;
  /** 秒。短命にする。 */
  expiresAt: number;
};

const STATE_TTL_SECONDS = 10 * 60;

export async function encodeLinkState(
  state: Omit<LinkState, "expiresAt">,
): Promise<string> {
  const payload: LinkState = {
    ...state,
    expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };

  const encrypted = await symmetricEncrypt({
    key: resolveSecretConfig(),
    data: JSON.stringify(payload),
  });

  // URL に載せるので base64url にする。
  return Buffer.from(encrypted, "utf8").toString("base64url");
}

export async function decodeLinkState(raw: string): Promise<LinkState | null> {
  try {
    const encrypted = Buffer.from(raw, "base64url").toString("utf8");
    const decrypted = await symmetricDecrypt({
      key: resolveSecretConfig(),
      data: encrypted,
    });
    const state = JSON.parse(decrypted) as LinkState;

    if (state.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return state;
  } catch {
    return null;
  }
}

/** 戻り先はアプリ内のパスだけ許す。外部 URL を渡されるとオープンリダイレクタになる。 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/lounge/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/lounge/account";
  return value;
}

// --- OAuth の往復 -----------------------------------------------------------

export function buildAuthorizeUrl(provider: SocialProvider, state: string): string | null {
  const creds = credentials(provider);
  if (!creds) return null;

  const config = CONFIG[provider];
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", creds.id);
  url.searchParams.set("redirect_uri", redirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);

  return url.toString();
}

async function exchangeCode(
  provider: SocialProvider,
  code: string,
): Promise<string | null> {
  const creds = credentials(provider);
  if (!creds) return null;

  const config = CONFIG[provider];
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // GitHub は既定でフォーム形式を返す。JSON を明示しないと解釈できない。
      accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: creds.id,
      client_secret: creds.secret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(provider),
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function fetchDiscordProfile(accessToken: string): Promise<SocialProfile | null> {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  return {
    providerAccountId: user.id,
    username: user.username,
    displayName: user.global_name ?? null,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : null,
    profileUrl: `https://discord.com/users/${user.id}`,
  };
}

async function fetchGithubProfile(accessToken: string): Promise<SocialProfile | null> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
      "user-agent": "HoshID",
    },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    html_url?: string | null;
  };

  return {
    providerAccountId: String(user.id),
    username: user.login,
    displayName: user.name ?? null,
    avatarUrl: user.avatar_url ?? null,
    profileUrl: user.html_url ?? `https://github.com/${user.login}`,
  };
}

/**
 * 認可コードを受け取り、相手側のプロフィールまで取る。
 *
 * **アクセストークンは保存しない。** 欲しいのは「本人であること」と表示用の
 * 名前とアイコンだけで、それは一度取れば足りる。持ち続ければ漏れたときの
 * 被害になるし、期限切れの面倒も抱え込む。
 */
export async function fetchSocialProfile(
  provider: SocialProvider,
  code: string,
): Promise<SocialProfile | null> {
  const accessToken = await exchangeCode(provider, code);
  if (!accessToken) return null;

  return provider === "discord"
    ? fetchDiscordProfile(accessToken)
    : fetchGithubProfile(accessToken);
}

// --- 保存 -------------------------------------------------------------------

export type LinkResult =
  | { ok: true }
  | { ok: false; reason: "taken" | "failed" };

/**
 * 連携を保存する。
 *
 * 同じ外部アカウントが別の HoshID アカウントに繋がっている場合は拒否する。
 * 許すと、1つの Discord アカウントで何人分もの申請を裏付けられることになり、
 * 本人確認の意味が消える。
 */
export async function saveSocialLink(
  userId: string,
  provider: SocialProvider,
  profile: SocialProfile,
): Promise<LinkResult> {
  const existing = await prisma.socialLink.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: { userId: true },
  });

  if (existing && existing.userId !== userId) {
    return { ok: false, reason: "taken" };
  }

  try {
    // 1人1つのサービス（GitHub）は、繋ぎ直しとして古い方を消してから入れる。
    // DB 側も部分ユニークインデックスで縛っているので、消さずに入れると落ちる。
    if (!SOCIAL_PROVIDER_META[provider].allowsMultiple) {
      await prisma.socialLink.deleteMany({
        where: { userId, provider, NOT: { providerAccountId: profile.providerAccountId } },
      });
    }

    await prisma.socialLink.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      create: { userId, provider, ...profile },
      // 繋ぎ直したら名前とアイコンを写し直す。相手側で変えた結果を反映する。
      update: { ...profile },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * 連携を外す。
 *
 * **必ず userId で絞る。** id だけで消せる作りにすると、他人の連携を
 * 外せてしまう。
 */
export async function removeSocialLink(userId: string, id: string): Promise<void> {
  await prisma.socialLink.deleteMany({ where: { id, userId } });
}

// --- GitHub の草 ------------------------------------------------------------

const CONTRIBUTIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

/** 件数を GitHub と同じ5段階に落とす。閾値はその年の最大値から決める。 */
function toLevel(count: number, max: number): ContributionDay["level"] {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.66) return 4;
  if (ratio > 0.33) return 3;
  if (ratio > 0.11) return 2;
  return 1;
}

/**
 * 直近1年の草を GitHub から取る。
 *
 * **外部サービスの画像を埋め込まない。** そうすると、メンバーページを開いた
 * 人の IP が第三者に渡り、その相手が落ちれば表示も壊れる。データだけ取って
 * 描画は自前で行う。
 *
 * 取得には `GITHUB_CONTRIBUTIONS_TOKEN`（読み取りのみの PAT）を使う。連携時に
 * 得た本人のトークンは保存していないため。
 */
async function fetchContributions(login: string): Promise<Contributions | null> {
  // **`GITHUB_TOKEN` という名前を使わないこと。** あの名前は広く使われていて、
  // シェルや OS の環境変数に残っていると .env より優先される（dotenv も
  // Next.js も、既に process.env にある値を上書きしない）。GitHub Actions に
  // 至っては実行時に自動で注入してくる。どちらの場合も、こちらの意図しない
  // トークンで API を叩いて 401 になり、原因が環境変数の衝突だと気づけない。
  const token = process.env.GITHUB_CONTRIBUTIONS_TOKEN;
  if (!token) {
    console.warn(
      "[HoshID][social] GITHUB_CONTRIBUTIONS_TOKEN が未設定のため、草を取得できません。" +
        " read:user を付けた読み取り専用の PAT を設定してください。",
    );
    return null;
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { date contributionCount }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "HoshID",
    },
    body: JSON.stringify({ query, variables: { login } }),
  });

  if (!response.ok) {
    // **黙って null を返さない。** 草が出ないだけなので誰も気づかず、
    // 「表示を選んだのに出ない」という問い合わせになって初めて分かる。
    // 401 はトークンの失効。GitHub の GraphQL は無効な資格情報を
    // スコープ不足と同じ 401 で返すので、その旨も添える。
    console.warn(
      `[HoshID][social] 草を取得できませんでした（HTTP ${response.status}）。` +
        (response.status === 401
          ? " GITHUB_CONTRIBUTIONS_TOKEN が無効か、スコープが足りません（GraphQL は" +
            "スコープの無いトークンも 401 で拒否します）。シェルや OS 側に同名の" +
            "環境変数が残っていないかも確認してください。"
          : ""),
    );
    return null;
  }

  const json = (await response.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) return null;

  const max = Math.max(
    0,
    ...calendar.weeks.flatMap((week) =>
      week.contributionDays.map((day) => day.contributionCount),
    ),
  );

  const weeks = calendar.weeks.map((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: toLevel(day.contributionCount, max),
    })),
  );

  const days = weeks.flat();

  return {
    total: calendar.totalContributions,
    weeks,
    from: days[0]?.date ?? "",
    to: days.at(-1)?.date ?? "",
  };
}

/**
 * 草を返す。キャッシュがあればそれを使い、古ければ取り直す。
 *
 * **取得に失敗しても古いキャッシュを捨てない。** GitHub が一時的に落ちている
 * だけでプロフィールから草が消えるより、少し古いものが出ている方がよい。
 */
export async function getContributions(userId: string): Promise<Contributions | null> {
  const link = await prisma.socialLink.findFirst({
    where: { userId, provider: "github" },
    select: {
      id: true,
      username: true,
      showContributions: true,
      contributions: true,
      contributionsFetchedAt: true,
    },
  });

  if (!link?.showContributions) return null;

  const cached = link.contributions as Contributions | null;
  const fresh =
    link.contributionsFetchedAt &&
    Date.now() - link.contributionsFetchedAt.getTime() < CONTRIBUTIONS_TTL_MS;

  if (cached && fresh) return cached;

  const fetched = await fetchContributions(link.username).catch(() => null);

  if (!fetched) return cached;

  await prisma.socialLink
    .update({
      where: { id: link.id },
      data: { contributions: fetched, contributionsFetchedAt: new Date() },
    })
    .catch(() => null);

  return fetched;
}
