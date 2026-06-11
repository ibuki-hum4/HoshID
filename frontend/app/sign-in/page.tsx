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
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import AuthShell from "../components/auth/AuthShell";

// Default to a relative path so requests resolve against the current
// origin instead of a `localhost:3000` baked in at build time.
const authOrigin = process.env.NEXT_PUBLIC_AUTH_SERVICE_ORIGIN ?? "";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="サインイン"
          subtitle="HoshID にログインして続行します。"
        >
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        </AuthShell>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const customId = String(form.get("customId") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const oauthQuery = searchParams.toString();

    const body: Record<string, string> = {
      username: customId,
      password,
      callbackURL: "",
    };
    if (oauthQuery.includes("sig=")) {
      body.oauth_query = oauthQuery;
    }

    try {
      const response = await fetch(`${authOrigin}/api/auth/sign-in/username`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            payload.error || payload.message || "サインインに失敗しました。",
          );
        }
        const text = await response.text();
        throw new Error(text || "サインインに失敗しました。");
      }

      window.location.href = "/dashboard";
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "サインインに失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="サインイン" subtitle="HoshID にログインして続行します。">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="カスタムID"
            name="customId"
            type="text"
            autoComplete="username"
            slotProps={{
              htmlInput: {
                pattern: "[a-z0-9._]+",
                title: "a-z, 0-9, . , _ のみ使用できます",
              },
            }}
            required
            fullWidth
          />
          <TextField
            label="パスワード"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            fullWidth
          />
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
            {loading ? "送信中..." : "サインイン"}
          </Button>
          <Typography variant="body2" color="text.secondary">
            アカウントをお持ちでない場合は
            <Link component={NextLink} href="/sign-up" sx={{ ml: 0.5 }}>
              サインアップ
            </Link>
            へ。
          </Typography>
        </Stack>
      </Box>
    </AuthShell>
  );
}
