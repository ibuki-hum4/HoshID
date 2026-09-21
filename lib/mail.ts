import nodemailer, { type Transporter } from "nodemailer";

import {
  renderEmail,
  renderText,
  type EmailBlock,
} from "@/lib/mail-template";

/**
 * さくらのメールボックスの SMTP へ送る。
 *
 * **送信の失敗で呼び出し元の処理を巻き戻さないこと。** 承認そのものは
 * 成立させ、メールは後から送り直せる扱いにする。承認できたのにメールが
 * 出せなかった、という理由で承認が取り消されるのは筋が悪い。
 */

let cached: Transporter | null = null;

function readConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;

  if (!host || !user || !pass || !from) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    // 587 は STARTTLS なので secure は false。465 のときだけ true。
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    from,
  };
}

/** SMTP が設定されているか。未設定なら送信処理は黙って何もしない。 */
export function isMailConfigured(): boolean {
  return readConfig() !== null;
}

function getTransport(): { transport: Transporter; from: string } | null {
  const config = readConfig();
  if (!config) return null;

  cached ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return { transport: cached, from: config.from };
}

export type MailMessage = {
  to: string;
  subject: string;
  /** HTML を読めないクライアント向けの代替。必ず用意する。 */
  text: string;
  html: string;
};

/**
 * メールを送る。失敗しても例外を投げず、成否を返すだけにする。
 */
export async function sendMail(
  message: MailMessage,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const configured = getTransport();
  if (!configured) {
    return { ok: false, reason: "SMTP が設定されていません。" };
  }

  try {
    await configured.transport.sendMail({
      from: configured.from,
      to: message.to,
      subject: message.subject,
      // text も一緒に送る。HTML だけだと迷惑メール判定されやすく、
      // テキストしか読めない環境で内容が伝わらない。
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "送信に失敗しました。",
    };
  }
}

function signInUrl(): string {
  const base = process.env.BETTER_AUTH_URL ?? "";
  return `${base.replace(/\/$/, "")}/sign-in`;
}

/**
 * メールアドレスの確認。
 *
 * 申請の直後に送る。**このリンクを開けた人だけがそのアドレスの持ち主**という
 * 前提が、承認メールの宛先と、後のパスワード再設定の両方を支えている。
 */
export function buildVerificationMail(
  name: string,
  to: string,
  url: string,
): MailMessage {
  const blocks: EmailBlock[] = [
    {
      type: "paragraph",
      text: "HoshID にアカウントを申請いただきありがとうございます。下のボタンからメールアドレスを確認してください。",
    },
    { type: "button", label: "メールアドレスを確認", url },
    {
      type: "paragraph",
      text: "確認が終わると審査に進みます。承認されると改めてお知らせします。",
    },
  ];
  const greeting = `${name} 様`;
  const footer =
    "このリンクは1時間で無効になります。申請に心当たりがない場合は、何もせずこのメールを破棄してください。";

  return {
    to,
    subject: "[HoshID] メールアドレスを確認してください",
    html: renderEmail({
      title: "メールアドレスの確認",
      heading: "メールアドレスを確認してください",
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

/**
 * パスワードの再設定。
 *
 * **心当たりが無い人に届く可能性のあるメール**なので、「誰かが再設定を要求した」
 * ことは伝えつつ、「何もしなければ何も起きない」と明記する。アカウントの存在を
 * 教えてしまう経路でもあるため、宛先以外には何も書かない。
 */
export function buildPasswordResetMail(
  name: string,
  to: string,
  url: string,
): MailMessage {
  const blocks: EmailBlock[] = [
    {
      type: "paragraph",
      text: "HoshID のパスワード再設定が要求されました。下のボタンから新しいパスワードを設定できます。",
    },
    { type: "button", label: "パスワードを再設定", url },
    {
      type: "paragraph",
      text: "再設定すると、ログイン中の他の端末はすべてログアウトされます。",
    },
  ];
  const greeting = `${name} 様`;
  const footer =
    "このリンクは1時間で無効になります。心当たりが無い場合は、何もせずこのメールを破棄してください。パスワードは変更されません。";

  return {
    to,
    subject: "[HoshID] パスワードの再設定",
    html: renderEmail({
      title: "パスワードの再設定",
      heading: "パスワードを再設定できます",
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

export function buildApprovalMail(name: string, to: string): MailMessage {
  const blocks: EmailBlock[] = [
    { type: "paragraph", text: "HoshID のアカウント申請が承認されました。下のボタンからログインできます。" },
    { type: "button", label: "HoshID にログイン", url: signInUrl() },
  ];
  const greeting = `${name} 様`;
  const footer = "このメールに心当たりがない場合は破棄してください。";

  return {
    to,
    subject: "[HoshID] アカウントが承認されました",
    // 本文にパスワードやトークンを入れない。ログイン URL だけを案内する。
    html: renderEmail({
      title: "アカウントが承認されました",
      heading: "アカウントが承認されました",
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

export function buildRejectionMail(
  name: string,
  to: string,
  reason: string,
): MailMessage {
  const blocks: EmailBlock[] = [
    { type: "paragraph", text: "HoshID のアカウント申請は承認されませんでした。" },
    { type: "paragraph", text: "理由:" },
    { type: "note", text: reason },
  ];
  const greeting = `${name} 様`;
  const footer =
    "お心当たりがない場合や、内容について確認したい場合は管理者にお問い合わせください。";

  return {
    to,
    subject: "[HoshID] アカウント申請の結果",
    html: renderEmail({
      title: "アカウント申請の結果",
      heading: "申請は承認されませんでした",
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

export function buildTwoFactorOtpMail(
  name: string,
  to: string,
  otp: string,
): MailMessage {
  const blocks: EmailBlock[] = [
    { type: "paragraph", text: "ログインを続けるための確認コードです。" },
    { type: "note", text: otp },
    {
      type: "paragraph",
      text: "このコードは数分で無効になります。心当たりがない場合は誰かがあなたのパスワードを知っている可能性があります。パスワードの変更をおすすめします。",
    },
  ];
  const greeting = `${name} 様`;
  const footer = "コードを他人に教えないでください。HoshID から問い合わせることはありません。";

  return {
    to,
    subject: "[HoshID] 確認コード",
    html: renderEmail({
      title: "確認コード",
      heading: "確認コード",
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

export function buildAnnouncementMail(
  name: string,
  to: string,
  announcement: { title: string; body: string },
  options: { mandatory?: boolean } = {},
): MailMessage {
  const blocks: EmailBlock[] = [
    {
      type: "paragraph",
      text: options.mandatory
        ? "HoshID から重要なお知らせがあります。"
        : "HoshID から新しいお知らせがあります。",
    },
    { type: "note", text: announcement.body },
    { type: "button", label: "HoshID で見る", url: announcementsUrl() },
  ];
  const greeting = `${name} 様`;
  // 受信設定を無視して送るものに「設定で止められます」と書くと嘘になる。
  const footer = options.mandatory
    ? "重要なお知らせのため、通知の設定に関わらずお送りしています。"
    : "このお知らせメールは、HoshID の設定 > 通知 から受け取らないようにできます。";

  return {
    to,
    subject: `[HoshID] ${announcement.title}`,
    html: renderEmail({
      title: announcement.title,
      heading: announcement.title,
      greeting,
      blocks,
      footer,
    }),
    text: renderText({ greeting, blocks, footer }),
  };
}

function announcementsUrl(): string {
  const base = process.env.BETTER_AUTH_URL ?? "";
  return `${base.replace(/\/$/, "")}/lounge/announcements`;
}
