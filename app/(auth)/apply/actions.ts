"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { issueApplicationTicket, readApplicationTicket } from "@/lib/application-ticket";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { APPLICATION_COOKIE } from "./constants";

/**
 * 申請の受け付けと、その続き。
 *
 * 申請はサーバ側で処理する。クライアントから `signUp.email` を直接叩いていた
 * のをここに移した理由は、**申請した本人にだけチケットを渡す**ため。
 * チケットはまだセッションを持てない申請者が、連携と確認メールの送信まで
 * 進むために使う（`lib/application-ticket.ts`）。
 */

export type ApplyResult = { ok: true } | { ok: false; message: string };

async function setTicket(userId: string) {
  const ticket = await issueApplicationTicket(userId);

  (await cookies()).set(APPLICATION_COOKIE, ticket, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 30 * 60,
  });
}

export async function submitApplication(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ApplyResult> {
  try {
    const result = await auth.api.signUpEmail({
      headers: await headers(),
      body: { name: input.name, email: input.email, password: input.password },
    });

    if (result?.user?.id) {
      await setTicket(result.user.id);
    }

    return { ok: true };
  } catch (error) {
    const code = (error as { body?: { code?: string } })?.body?.code;

    // **既に登録済みでも、申請できたかどうかを区別させない。** 区別できると
    // 「誰が HoshID を使っているか」を総当たりで調べられる。この先の画面も
    // 同じように見せるため、どこも指さないチケットを持たせる。既存の
    // アカウントを指すチケットを渡してはいけない。それを渡すと、
    // 他人のアカウントに自分の Discord を繋げてしまう。
    if (code === "USER_ALREADY_EXISTS") {
      await setTicket(`missing_${randomBytes(12).toString("hex")}`);
      return { ok: true };
    }

    return {
      ok: false,
      message: "申請を受け付けられませんでした。しばらくしてからもう一度お試しください。",
    };
  }
}

/**
 * 申請の最後。確認メールを送る。
 *
 * **送るのはここ**（申請直後ではない）。画面で「メールを確認してください」と
 * 言う瞬間に届く方が分かりやすく、順序も 申請 → 連携 → メール確認 で揃う。
 */
export async function sendApplicationVerification(): Promise<void> {
  // **userId を引数で受け取らない。** 受け取ると、誰でも任意のアカウント宛に
  // 確認メールを送らせる口になる。誰の話かは Cookie のチケットだけで決める。
  const ticket = (await cookies()).get(APPLICATION_COOKIE)?.value;
  const userId = ticket ? await readApplicationTicket(ticket) : null;
  if (!userId) return;

  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } })
    .catch(() => null);

  if (!user || user.emailVerified) return;

  try {
    await auth.api.sendVerificationEmail({
      headers: await headers(),
      body: { email: user.email, callbackURL: "/sign-in" },
    });
  } catch (error) {
    // 送れなくても申請は成立している。画面には「送った」と出したうえで、
    // 届かない場合の案内を添える。運用側にはログを残す。
    console.warn("[HoshID] 確認メールを送れませんでした:", error);
  }
}
