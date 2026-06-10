import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const main = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "32px",
  maxWidth: "480px",
  borderRadius: "8px",
};

const headingStyle = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#18181b",
  marginBottom: "16px",
};

const hrStyle = {
  borderColor: "#e4e4e7",
  margin: "24px 0",
};

const footerText = {
  fontSize: "12px",
  color: "#71717a",
};

type EmailLayoutProps = {
  previewText: string;
  heading: string;
  children: ReactNode;
};

export function EmailLayout({
  previewText,
  heading,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={headingStyle}>{heading}</Heading>
          {children}
          <Hr style={hrStyle} />
          <Text style={footerText}>
            このメールは HoshID
            から自動送信されています。心当たりがない場合は破棄してください。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
