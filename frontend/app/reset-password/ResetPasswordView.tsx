"use client";

import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { useState } from "react";

import AuthShell from "../components/auth/AuthShell";

const authOrigin =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_ORIGIN ?? "http://localhost:3000";

type ResetPasswordViewProps = {
  token: string;
};

export default function ResetPasswordView({ token }: ResetPasswordViewProps) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    const confirm = String(form.get("passwordConfirm") ?? "");

    if (!token) {
      setError(
        "リセット用トークンが見つかりません。メールのリンクから開き直してください。",
      );
      return;
    }

    if (!newPassword) {
      setError("新しいパスワードを入力してください。");
      return;
    }

    if (newPassword !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${authOrigin}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            payload.error ||
              payload.message ||
              "パスワードの更新に失敗しました。",
          );
        }
        const text = await response.text();
        throw new Error(text || "パスワードの更新に失敗しました。");
      }

      setNotice("パスワードを更新しました。サインイン画面へ移動します。");
      window.location.href = "/sign-in";
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "パスワードの更新に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="パスワードリセット"
      subtitle="新しいパスワードを設定します。"
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}
          <TextField
            label="新しいパスワード"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            fullWidth
          />
          <TextField
            label="新しいパスワード（確認）"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ py: 1.4, fontWeight: 700 }}
          >
            {loading ? "更新中..." : "パスワードを更新"}
          </Button>
          <Typography variant="body2" color="text.secondary">
            サインイン画面に戻る場合は
            <Link component={NextLink} href="/sign-in" sx={{ ml: 0.5 }}>
              こちら
            </Link>
            。
          </Typography>
        </Stack>
      </Box>
    </AuthShell>
  );
}
