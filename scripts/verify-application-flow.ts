/**
 * アカウント申請フローの安全性を実地で確認する。
 *
 *   bun run scripts/verify-application-flow.ts
 *
 * ここで守られているべき性質:
 *   1. 申請したユーザーは pending になる
 *   2. 申請時に status を詐称しても無視される
 *   3. pending のままではセッションが発行されない
 *   4. approved にすると初めてログインできる
 *
 * 検証用ユーザーは最後に削除する。
 */
import { ACCOUNT_STATUS } from "@/lib/account-status";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL = `verify-${Date.now()}@hoshid.invalid`;
const PASSWORD = "verify-password-12345678";

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`);
  if (!ok) {
    failures += 1;
    if (detail !== undefined) console.log("        ", detail);
  }
}

/** サインインを試し、セッション Cookie が返るかどうかを返す。 */
async function trySignIn(): Promise<boolean> {
  try {
    const response = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      asResponse: true,
    });
    if (!response.ok) return false;
    return response.headers.getSetCookie().length > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n検証用ユーザー: ${EMAIL}\n`);

  // 0: role の注入は明示的に拒否されること（無視ではなくエラーになる）
  let roleInjectionRejected = false;
  try {
    await auth.api.signUpEmail({
      body: {
        email: `role-${EMAIL}`,
        password: PASSWORD,
        name: "Role Injection",
        role: "admin",
      } as never,
    });
  } catch {
    roleInjectionRejected = true;
  }
  check("role の注入は拒否される", roleInjectionRejected);
  await prisma.user.deleteMany({ where: { email: `role-${EMAIL}` } });

  // 1 & 2: status: "approved" を混ぜて申請する
  await auth.api.signUpEmail({
    body: {
      email: EMAIL,
      password: PASSWORD,
      name: "Verify User",
      // 攻撃者が承認を自称しようとするケース
      status: ACCOUNT_STATUS.approved,
    } as never,
  });

  const applied = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { status: true, role: true, appliedAt: true },
  });

  check("申請したユーザーは pending になる", applied?.status === ACCOUNT_STATUS.pending, applied);
  check("status の詐称が無視される", applied?.status !== ACCOUNT_STATUS.approved, applied);
  check("appliedAt が記録される", applied?.appliedAt instanceof Date, applied);

  // 3: pending のままログインできないこと
  check("pending ではセッションが発行されない", (await trySignIn()) === false);

  // 4: 承認すればログインできること
  await prisma.user.update({
    where: { email: EMAIL },
    data: { status: ACCOUNT_STATUS.approved },
  });
  check("approved にするとログインできる", (await trySignIn()) === true);

  // 5: 却下すると再び入れなくなること
  await prisma.user.update({
    where: { email: EMAIL },
    data: { status: ACCOUNT_STATUS.rejected },
  });
  check("rejected にすると再びログインできない", (await trySignIn()) === false);

  await prisma.user.delete({ where: { email: EMAIL } });
  console.log(`\n${failures === 0 ? "すべて PASS" : `${failures} 件 FAIL`}\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
