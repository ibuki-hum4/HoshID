import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { ac, roles } from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), oauthProviderClient()],
});
