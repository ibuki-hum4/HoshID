import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    const smtpConfig = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "1025", 10),
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || "",
          }
        : undefined,
      secure: process.env.SMTP_PORT === "465",
      tls: {
        // Default to verifying the server certificate. Only disable for local
        // development against a mail catcher with a self-signed certificate.
        rejectUnauthorized:
          process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
      },
    };

    transporter = nodemailer.createTransport(smtpConfig);
  }
  return transporter;
}

export async function sendVerificationEmail(email: string, url: string) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || "noreply@hoshid.local";

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: "HoshID - メールアドレス確認",
      html: `
        <h2>メールアドレス確認</h2>
        <p>以下のリンクをクリックしてメールアドレスを確認してください。</p>
        <p><a href="${url}">メールアドレスを確認</a></p>
        <p>リンクは24時間有効です。</p>
      `,
      text: `メールアドレス確認: ${url}`,
    });
  } catch (error) {
    console.error(`[Email] Failed to send verification email to ${email}:`, error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || "noreply@hoshid.local";

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: "HoshID - パスワードリセット",
      html: `
        <h2>パスワードリセット</h2>
        <p>以下のリンクをクリックしてパスワードをリセットしてください。</p>
        <p><a href="${url}">パスワードをリセット</a></p>
        <p>リンクは1時間有効です。</p>
      `,
      text: `パスワードリセット: ${url}`,
    });
  } catch (error) {
    console.error(`[Email] Failed to send password reset email to ${email}:`, error);
    throw error;
  }
}

export async function sendApprovalCredentialsEmail(
  recipientEmail: string,
  loginEmail: string,
  password: string,
) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || "noreply@hoshid.local";

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: "HoshID - アカウント承認のお知らせ",
      html: `
        <h2>アカウント承認のお知らせ</h2>
        <p>申請が承認されました。以下の情報でログインしてください。</p>
        <p><strong>ログインメールアドレス:</strong> ${loginEmail}</p>
        <p><strong>初期パスワード:</strong> ${password}</p>
        <p>ログイン後にパスワードを変更してください。</p>
      `,
      text: `アカウント承認のお知らせ\nログインメールアドレス: ${loginEmail}\n初期パスワード: ${password}\nログイン後にパスワードを変更してください。`,
    });
  } catch (error) {
    console.error(`[Email] Failed to send approval credentials to ${recipientEmail}:`, error);
    throw error;
  }
}
