/**
 * 初代管理者を作る。
 *
 * HoshID のアカウントは申請 → 承認を経ないと有効にならないため、最初の一人は
 * この経路で作らないと「承認できる人間が誰もいない」状態で詰む。
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... bun run scripts/seed-admin.ts
 *
 * 冪等。既にユーザーが居る場合はパスワードを変えず、承認済み・admin である
 * ことだけを保証する。
 */
import { ACCOUNT_STATUS } from "@/lib/account-status";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function main() {
  const email = requireEnv("SEED_ADMIN_EMAIL");
  const name = process.env.SEED_ADMIN_NAME ?? "HoshID Admin";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const password = requireEnv("SEED_ADMIN_PASSWORD");
    // signUpEmail を使うのは、パスワードのハッシュ化を auth.ts の設定
    // （Argon2id とそのパラメータ）と一致させるため。手で hash すると
    // 設定を変えたときに静かにズレる。
    await auth.api.signUpEmail({ body: { email, password, name } });
    console.log(`created user: ${email}`);
  } else {
    console.log(`user already exists: ${email}`);
  }

  const promoted = await prisma.user.update({
    where: { email },
    data: {
      status: ACCOUNT_STATUS.approved,
      role: "admin",
      emailVerified: true,
      reviewedAt: new Date(),
      reviewedBy: "seed-admin script",
      reviewNote: "初代管理者として作成",
    },
    select: { id: true, email: true, status: true, role: true },
  });

  console.log("seeded admin:", promoted);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
