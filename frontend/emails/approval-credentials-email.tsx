import { Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/layout";

const text = { fontSize: "14px", lineHeight: "24px", color: "#3f3f46" };

const credentialBox = {
  backgroundColor: "#f4f4f5",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "8px 0",
};

const credentialLabel = {
  fontSize: "12px",
  color: "#71717a",
  margin: "0 0 4px",
};

const credentialValue = {
  fontFamily:
    'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace',
  fontSize: "14px",
  color: "#18181b",
  margin: 0,
};

export type ApprovalCredentialsEmailProps = {
  loginEmail: string;
  password: string;
};

export function ApprovalCredentialsEmail({
  loginEmail,
  password,
}: ApprovalCredentialsEmailProps) {
  return (
    <EmailLayout
      previewText="アカウントが承認されました"
      heading="アカウント承認のお知らせ"
    >
      <Text style={text}>
        申請が承認されました。以下の情報でログインしてください。
      </Text>
      <Section style={credentialBox}>
        <Text style={credentialLabel}>ログインID（メールアドレス）</Text>
        <Text style={credentialValue}>{loginEmail}</Text>
      </Section>
      <Section style={credentialBox}>
        <Text style={credentialLabel}>初期パスワード</Text>
        <Text style={credentialValue}>{password}</Text>
      </Section>
      <Text style={text}>ログイン後にパスワードを変更してください。</Text>
    </EmailLayout>
  );
}

export default ApprovalCredentialsEmail;
