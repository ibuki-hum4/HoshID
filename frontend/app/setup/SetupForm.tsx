"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export default function SetupForm() {
  const router = useRouter();
  const authOrigin =
    process.env.NEXT_PUBLIC_AUTH_SERVICE_ORIGIN ?? "http://localhost:3000";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError("パスワードが一致しません");
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("パスワードは8文字以上である必要があります");
      setLoading(false);
      return;
    }

    const requestedUsername = formData.username.trim();
    if (!requestedUsername) {
      setError("カスタムIDを入力してください");
      setLoading(false);
      return;
    }

    const username = normalizeUsername(requestedUsername);
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      setError(formatError);
      setLoading(false);
      return;
    }

    try {
      // Better Auth の sign-up
      const signUpResponse = await fetch(
        `${authOrigin}/api/auth/sign-up/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            name: "Administrator",
            username,
            email: formData.email,
            password: formData.password,
            callbackURL: `${window.location.origin}/setup/complete`,
          }).toString(),
          credentials: "include",
        },
      );

      if (!signUpResponse.ok) {
        setError("ユーザー作成に失敗しました");
        setLoading(false);
        return;
      }

      // メール送信
      try {
        await fetch("/api/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email }),
        }).catch((err) => console.error("Email send error:", err));
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }

      // admin ロール付与
      try {
        const adminResponse = await fetch("/api/admin/make-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email }),
        });

        if (!adminResponse.ok) {
          console.error("Failed to make user admin");
        }
      } catch (adminError) {
        console.error("Admin role assignment error:", adminError);
      }

      setSuccess(
        "管理者ユーザーを作成しました。ダッシュボードにリダイレクトします...",
      );

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("[Setup] Error:", error);
      setError("セットアップに失敗しました");
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingY: 4,
        }}
      >
        <Stack spacing={3} sx={{ width: "100%" }}>
          <Typography variant="h3" component="h1" align="center">
            HoshID セットアップ
          </Typography>

          <Typography variant="body1" color="text.secondary" align="center">
            初回セットアップ時に管理者ユーザーを作成します。
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="メールアドレス"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />

              <TextField
                fullWidth
                label="カスタムID"
                name="username"
                autoComplete="off"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                helperText="3〜30文字の半角英数字、._ のみ使用できます。ログイン時に使用します。"
              />

              <TextField
                fullWidth
                label="パスワード"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                helperText="8文字以上"
              />

              <TextField
                fullWidth
                label="パスワード（確認）"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  "セットアップを完了"
                )}
              </Button>
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" align="center">
            このページは初回アクセス時のみ表示されます。
          </Typography>
        </Stack>
      </Box>
    </Container>
  );
}
