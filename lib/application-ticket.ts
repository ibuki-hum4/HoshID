import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

import { resolveSecretConfig } from "@/lib/jwks";

/**
 * 申請の途中で「この申請者」を指すための短命のチケット。
 *
 * **申請者はまだセッションを持てない。** ログインできるのは `active` だけで、
 * 申請直後は `prepared` だから（`canSignIn`）。ここをセッションで解こうとすると
 * 核心の不変条件を緩めることになる。代わりに、暗号化した短命の値で
 * 「どの申請の話か」だけを持ち回る。
 *
 * このチケットで**できること**は、申請に外部サービスの連携を付けることと、
 * 確認メールを送り直すことだけ。ログインでも、何かを読み出す手段でもない。
 */

export type ApplicationTicket = {
  userId: string;
  /** 秒。 */
  expiresAt: number;
};

/** 申請してから連携を済ませるまでの猶予。長く持たせる理由が無い。 */
const TICKET_TTL_SECONDS = 30 * 60;

export async function issueApplicationTicket(userId: string): Promise<string> {
  const payload: ApplicationTicket = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  };

  const encrypted = await symmetricEncrypt({
    key: resolveSecretConfig(),
    data: JSON.stringify(payload),
  });

  return Buffer.from(encrypted, "utf8").toString("base64url");
}

/**
 * チケットから userId を取り出す。無効なら null。
 *
 * 名前は consume だが一度きりにはしていない。連携をやり直したい人が
 * 同じ画面から何度か押せる方がよく、できることが上のとおり限られているため。
 */
export function consumeApplicationTicket(raw: string): Promise<string | null> {
  return readApplicationTicket(raw);
}

export async function readApplicationTicket(raw: string): Promise<string | null> {
  try {
    const encrypted = Buffer.from(raw, "base64url").toString("utf8");
    const decrypted = await symmetricDecrypt({
      key: resolveSecretConfig(),
      data: encrypted,
    });
    const ticket = JSON.parse(decrypted) as ApplicationTicket;

    if (ticket.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return ticket.userId;
  } catch {
    return null;
  }
}
