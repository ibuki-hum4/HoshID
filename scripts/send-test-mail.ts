/**
 * SMTP の設定が正しいかを確認する。
 *
 *   MAIL_TEST_TO=you@example.jp bun run scripts/send-test-mail.ts
 */
import { buildApprovalMail, isMailConfigured, sendMail } from "@/lib/mail";

const to = process.env.MAIL_TEST_TO ?? process.env.SEED_ADMIN_EMAIL;

if (!isMailConfigured()) {
  console.error("SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM を .env に設定してください。");
  process.exit(1);
}
if (!to) {
  console.error("MAIL_TEST_TO を指定してください。");
  process.exit(1);
}

console.log(`送信先: ${to}`);
const result = await sendMail(buildApprovalMail("テスト送信", to));

if (result.ok) {
  console.log("送信しました。受信箱と迷惑メールフォルダの両方を確認してください。");
} else {
  console.error("送信に失敗しました:", result.reason);
  process.exitCode = 1;
}
