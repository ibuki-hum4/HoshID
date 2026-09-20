import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import {
  adminClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";
import { ac, roles } from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    // auth.ts の user.additionalFields をクライアント側の型に反映させる。
    // これが無いと applicationReason を送るコードが型エラーになる。
    // `import type` なのでサーバのコードはバンドルに入らない。
    inferAdditionalFields<typeof auth>(),
    adminClient({ ac, roles }),
    oauthProviderClient(),
  ],
});
