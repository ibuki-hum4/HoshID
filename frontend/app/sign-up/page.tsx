"use client";

import { Suspense } from "react";
import { useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AuthShell from "../components/auth/AuthShell";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="サインアップ" subtitle="新しい HoshID アカウントを作成します。">
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        </AuthShell>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const username = String(form.get("username") ?? "").trim();

    const body: Record<string, string> = {
      name,
      email,
      ...(username ? { username } : {}),
    };

    try {
      const response = await fetch(`/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSignedUpEmail(email);
        setNotice("申請を受け付けました。承認後にログイン情報がメールで届きます。");
        return;
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { error?: string; message?: string };
          throw new Error(payload.error || payload.message || "サインアップに失敗しました。");
        }
        const text = await response.text();
        throw new Error(text || "サインアップに失敗しました。");
      }

    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "サインアップに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="サインアップ"
      subtitle="新しい HoshID アカウントを作成します。"
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}
          <TextField
            label="名前"
            name="name"
            autoComplete="name"
            required
            fullWidth
          />
          <TextField
            label="メール"
            name="email"
            type="email"
            autoComplete="email"
            required
            fullWidth
          />
          <TextField
            label="希望するカスタムID（任意）"
            name="username"
            autoComplete="off"
            fullWidth
            helperText="3〜30文字の半角英数字、._ のみ使用できます。空欄の場合は承認時に管理者が設定します。"
          />
          {signedUpEmail ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled
                sx={{
                  py: 1.4,
                  fontWeight: 700,
                  opacity: 0.45,
                }}
              >
                申請済み
              </Button>
            </Box>
          ) : (
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.4,
                fontWeight: 700,
              }}
            >
              {loading ? "送信中..." : "申請する"}
            </Button>
          )}
          <Typography variant="body2" color="text.secondary">
            既にアカウントをお持ちの場合は
            <Link component={NextLink} href="/sign-in" sx={{ ml: 0.5 }}>
              サインイン
            </Link>
            へ。
          </Typography>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        登録後は管理者の承認が必要な場合があります。
      </Typography>
    </AuthShell>
  );
}
