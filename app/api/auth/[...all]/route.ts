import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Argon2id (@node-rs/argon2) はネイティブモジュールなので Edge では動かない。
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
