import { render } from "@react-email/render";
import nodemailer from "nodemailer";

import { ApprovalCredentialsEmail } from "@/emails/approval-credentials-email";
import { PasswordResetEmail } from "@/emails/password-reset-email";
import { VerificationEmail } from "@/emails/verification-email";

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
    const element = <VerificationEmail url={url} />;
    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: "HoshID - メールアドレス確認",
      html: await render(element),
      text: await render(element, { plainText: true }),
    });
  } catch (error) {
    console.error(
      `[Email] Failed to send verification email to ${email}:`,
      error,
    );
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || "noreply@hoshid.local";

  try {
    const element = <PasswordResetEmail url={url} />;
    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: "HoshID - パスワードリセット",
      html: await render(element),
      text: await render(element, { plainText: true }),
    });
  } catch (error) {
    console.error(
      `[Email] Failed to send password reset email to ${email}:`,
      error,
    );
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
    const element = (
      <ApprovalCredentialsEmail loginEmail={loginEmail} password={password} />
    );
    await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: "HoshID - アカウント承認のお知らせ",
      html: await render(element),
      text: await render(element, { plainText: true }),
    });
  } catch (error) {
    console.error(
      `[Email] Failed to send approval credentials to ${recipientEmail}:`,
      error,
    );
    throw error;
  }
}
