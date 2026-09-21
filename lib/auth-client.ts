import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  deviceAuthorizationClient,
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";
import { ac, roles } from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    // auth.ts の user.additionalFields をクライアント側の型に反映させる。
    // これが無いと nickname や bio を送るコードが型エラーになる。
    // `import type` なのでサーバのコードはバンドルに入らない。
    inferAdditionalFields<typeof auth>(),
    adminClient({ ac, roles }),
    deviceAuthorizationClient(),
    passkeyClient(),
    twoFactorClient({
      // パスワードが正しくても 2FA が残っている場合、Better Auth は
      // セッションを張らずにここを呼ぶ。確認画面へ送る。
      onTwoFactorRedirect() {
        // ここは React の外から呼ばれるコールバックで router を使えない。
        // また 2FA の確認画面はセッション未確立の状態から入るため、
        // クライアント遷移ではなくフルロードさせたい。
        // 認可フローの署名付きクエリはそのまま引き継ぐ。
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/two-factor${window.location.search}`);
      },
    }),
    oauthProviderClient(),
  ],
});
