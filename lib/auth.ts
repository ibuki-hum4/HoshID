import {
  oauthDeviceAuthorization,
  oauthProvider,
} from "@better-auth/oauth-provider";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { admin, jwt, twoFactor } from "better-auth/plugins";

import { ACCOUNT_STATUS, canSignIn } from "@/lib/account-status";
import {
  ACR_CLAIM,
  AMR,
  ACR_VALUES_SUPPORTED,
  AMR_CLAIM,
  acrFromAmr,
  amrFromPath,
  parseAmr,
  serializeAmr,
} from "@/lib/amr";
import {
  JWKS_GRACE_PERIOD_SECONDS,
  JWKS_KEY_PAIR_CONFIG,
  JWKS_ROTATION_INTERVAL_SECONDS,
} from "@/lib/jwks";
import { ac, roles } from "@/lib/permissions";
import { TRUSTED_PROXIES } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import {
  buildPasswordResetMail,
  buildTwoFactorOtpMail,
  buildVerificationMail,
  sendMail,
} from "@/lib/mail";
import { notifyWebhooks } from "@/lib/webhook";

/**
 * `@node-rs/argon2` は Algorithm を ambient const enum として宣言しており、
 * `isolatedModules` 下では import できない。Argon2id の数値が 2。
 */
const ARGON2ID = 2;

/**
 * OWASP の推奨値。`@node-rs/argon2` の既定値と一致しているが、後から既定値が
 * 変わってもハッシュが静かに弱くならないよう明示している。
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

/** セッションに記録した認証方法を、RP へ渡すクレームに変換する。 */
async function resolveAuthenticationClaims(
  sessionId: string | undefined,
): Promise<Record<string, unknown>> {
  if (!sessionId) return {};

  const session = await prisma.session
    .findUnique({ where: { id: sessionId }, select: { amr: true } })
    .catch(() => null);

  const amr = parseAmr(session?.amr);
  return { [AMR_CLAIM]: amr, [ACR_CLAIM]: acrFromAmr(amr) };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const auth = betterAuth({
  // Discovery が返す `issuer` と ID トークンの `iss` はこの値から決まる。
  // RP 側の設定と1文字でも違うと繋がらない。
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // 申請直後はまだ pending なのでセッションを作れない。自動サインインを
    // 有効にしたままだと申請の最後でセッション生成が拒否されて失敗する。
    autoSignIn: false,
    // 既定は scrypt。Argon2id に差し替える。
    password: {
      hash: (password) => argon2Hash(password, ARGON2_OPTIONS),
      verify: ({ hash, password }) => argon2Verify(hash, password),
    },

    /**
     * メールアドレスの確認をログインの条件にする。
     *
     * これが無いと、他人のメールアドレスで申請できてしまう。承認した管理者は
     * 本人だと思い込み、そのアカウントは ID トークンに他人のアドレスを載せて
     * RP へ渡る。**RP の多くはメールアドレスでアカウントを紐づける**ので、
     * なりすましの経路になる。
     *
     * ステータスによる遮断（canSignIn）とは別の関門。片方だけでは足りない。
     */
    requireEmailVerification: true,

    /**
     * パスワード再設定。
     *
     * 送信の成否を呼び出し元に伝えない。**あるアドレスが登録済みかどうかを
     * 教えないため**で、画面には要求の成否に関わらず同じ文言を出す。
     */
    sendResetPassword: async ({ user, url }) => {
      const result = await sendMail(
        buildPasswordResetMail(user.name, user.email, url),
      );
      if (!result.ok) {
        // 握り潰すと、利用者は届かないメールを待ち続ける。運用側には残す。
        console.warn("[HoshID] パスワード再設定メールを送れませんでした:", result.reason);
      }
    },

    /**
     * 再設定したら他の端末を全部ログアウトさせる。
     *
     * 再設定する理由の多くは「パスワードが漏れたかもしれない」なので、
     * 既存のセッションを生かしたままでは再設定の意味が薄い。
     */
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const result = await sendMail(
        buildVerificationMail(user.name, user.email, url),
      );
      if (!result.ok) {
        console.warn("[HoshID] 確認メールを送れませんでした:", result.reason);
      }
    },
    // **申請の直後には送らない。** 順序は 申請 → 連携 → メール確認 で、
    // 確認メールは連携の段が終わったところで明示的に送る
    // （app/(auth)/apply/actions.ts の sendApplicationVerification）。
    // 画面で「メールを確認してください」と言う瞬間に届く方が分かりやすい。
    sendOnSignUp: false,
    // 未確認のままログインを試みた人に送り直す。最初のリンクは1時間で切れる
    // ので、これが無いと本人には詰みを解く手段が無い。
    sendOnSignIn: true,
    // 確認できてもセッションは作らない。ログインできるかは承認の有無で決まる。
    autoSignInAfterVerification: false,
  },

  user: {
    additionalFields: {
      /**
       * `input: false` が肝。これが無いと申請 API に `status: "approved"` を
       * 混ぜるだけで承認を自称できる。下の create フックと二重の防御。
       */
      status: {
        type: "string",
        defaultValue: ACCOUNT_STATUS.prepared,
        input: false,
      },
      /** お知らせをメールでも受け取るか。本人が切り替える。 */
      notifyAnnouncements: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      /** 本人が編集できるプロフィール項目。 */
      nickname: { type: "string", required: false },
      bio: { type: "string", required: false },
      appliedAt: { type: "date", required: false, input: false },
      reviewedAt: { type: "date", required: false, input: false },
      reviewedBy: { type: "string", required: false, input: false },
      reviewNote: { type: "string", required: false, input: false },
    },
  },

  session: {
    additionalFields: {
      /**
       * このセッションがどの方法で認証されたか（空白区切り）。
       * ID トークンの hoshid_amr / hoshid_acr の元になる。
       */
      amr: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 通知は申請そのものとは切り離す。失敗しても申請は成立させる。
          await notifyWebhooks({
            type: "application.submitted",
            name: user.name,
            email: user.email,
          }).catch(() => undefined);
        },
        before: async (user) => {
          // クライアントが何を送ってきてもサーバ側で pending に固定する。
          return {
            data: {
              ...user,
              status: ACCOUNT_STATUS.prepared,
              appliedAt: new Date(),
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => {
          // 未承認ユーザーの遮断はここが本丸。ログイン画面を塞ぐだけでは
          // RP 経由で /oauth2/authorize に直接入られた時に素通りする。
          // セッションが作れなければ認可フローも UserInfo も通らない。
          const account = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });

          if (!canSignIn(account?.status)) {
            return false;
          }

          // どの経路でセッションが生まれたかを記録する。Better Auth は
          // 認証方法を残さないので、ここで捕まえないと後から分からない。
          return {
            data: {
              ...session,
              amr: serializeAmr(amrFromPath(context?.path)),
            },
          };
        },
      },
    },
  },

  advanced: {
    ipAddress: {
      // 信頼するプロキシ。理由と、設定しないと何が起きるかは lib/request-ip.ts。
      // **プロキシの後ろに置くなら必ず設定すること。**
      trustedProxies: TRUSTED_PROXIES,
    },
  },

  // jwt() が生やす /token は OAuth の /oauth2/token と紛らわしいので塞ぐ。
  disabledPaths: ["/token"],

  plugins: [
    jwt({
      jwks: {
        keyPairConfig: JWKS_KEY_PAIR_CONFIG,
        // 署名鍵の自動ローテーション。期限の切れた鍵しか無くなると、
        // Better Auth が署名時に新しい鍵をその場で作る。退役した鍵は
        // 猶予期間のあいだ JWKS に残り、発行済みトークンの検証を続ける。
        // 値の根拠と、猶予期間を縮めてはいけない理由は lib/jwks.ts。
        rotationInterval: JWKS_ROTATION_INTERVAL_SECONDS,
        gracePeriod: JWKS_GRACE_PERIOD_SECONDS,
      },
    }),

    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),

    twoFactor({
      // 認証アプリに表示される発行者名。
      issuer: "HoshID",
      // 有効化の時点で必ずコードを検証させる。省くと、QR を読み取れて
      // いないのに有効化され、次のログインで本人が締め出される。
      skipVerificationOnEnable: false,
      totpOptions: { digits: 6, period: 30 },
      otpOptions: {
        digits: 6,
        // 認証アプリを持っていない／手元に無い場合の代替手段。
        // メールが届く前提なので、TOTP より有効期間を長めに取る。
        period: 5,
        async sendOTP({ user, otp }) {
          const result = await sendMail(
            buildTwoFactorOtpMail(user.name, user.email, otp),
          );
          if (!result.ok) {
            // 送れなかったことを握り潰すと、利用者は届かないコードを
            // 待ち続けることになる。
            console.warn("[HoshID] 2FA コードの送信に失敗しました:", result.reason);
          }
        },
      },
    }),

    passkey({
      rpName: "HoshID",
      // rpID はホスト名のみ（ポートやスキームを含めない）。ここが実際の
      // 配信ホストとズレると、登録した鍵が使えなくなる。
      rpID: new URL(requireEnv("BETTER_AUTH_URL")).hostname,
      origin: requireEnv("BETTER_AUTH_URL"),
      authenticatorSelection: {
        // 端末やパスワードマネージャに保存させ、別端末でも使えるようにする。
        residentKey: "preferred",
        userVerification: "preferred",
      },
    }),

    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      requirePKCE: true,
      // 認証方法を RP に伝える。標準の acr / amr は使えないため
      // 名前空間付きの独自クレームで出す（lib/amr.ts の説明を参照）。
      // acr_values_supported は provider が ["0"] を所有していて
      // 拡張から上書きできない（未設定のキーしか足せない）。RP には
      // 独自クレーム側を見てもらう。
      advertisedMetadata: {
        claims_supported: [AMR_CLAIM, ACR_CLAIM],
        [`${AMR_CLAIM}_values_supported`]: Object.values(AMR),
        [`${ACR_CLAIM}_values_supported`]: ACR_VALUES_SUPPORTED,
      },
      extensions: [
        {
          // UserInfo 側の入力には sessionId が無いので ID トークンにだけ出す。
          // 認証の文脈は ID トークンが本来の置き場所でもある。
          claims: {
            idToken: ({ sessionId }) => resolveAuthenticationClaims(sessionId),
          },
        },
      ],
      accessTokenExpiresIn: 60 * 60, // 1h
      refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d
      storeClientSecret: "hashed",
    }),

    // CLI やテレビなど、入力しづらい機器のための Device Code (RFC 8628)。
    // oauthProvider より後に置く。
    oauthDeviceAuthorization({
      // 利用者がコードを入力しきるまでの猶予。短すぎると打ち直しになる。
      expiresIn: "10m",
      // 機器側がトークンを問い合わせてよい間隔。
      interval: "5s",
      userCodeLength: 8,
    }),

    // Server Action から Set-Cookie を返すために必要。必ず最後に置く。
    nextCookies(),
  ],
});
