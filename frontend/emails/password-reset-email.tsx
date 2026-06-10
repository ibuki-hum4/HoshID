import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/layout";

const text = { fontSize: "14px", lineHeight: "24px", color: "#3f3f46" };

const button = {
  backgroundColor: "#18181b",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 24px",
};

export type PasswordResetEmailProps = {
  url: string;
};

export function PasswordResetEmail({ url }: PasswordResetEmailProps) {
  return (
    <EmailLayout
      previewText="パスワードをリセットしてください"
      heading="パスワードリセット"
    >
      <Text style={text}>
        以下のボタンをクリックしてパスワードをリセットしてください。
      </Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={url} style={button}>
          パスワードをリセット
        </Button>
      </Section>
      <Text style={text}>リンクは1時間有効です。</Text>
      <Text style={text}>
        ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください。
        <br />
        {url}
      </Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;
