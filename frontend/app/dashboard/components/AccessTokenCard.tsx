"use client";

import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

import { authClient } from "@/lib/auth-client";

type AccessTokenResponse = {
  accessToken?: string;
  accessTokenExpiresAt?: string;
  idToken?: string;
};

export default function AccessTokenCard() {
  const [providerId, setProviderId] = useState("google");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await authClient.getSession();
      const userId = session.data?.user?.id;

      const response = await fetch("/api/auth/access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ providerId, userId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load access token.");
      }

      const payload = (await response.json()) as AccessTokenResponse;
      setToken(payload.accessToken || payload.idToken || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load access token.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={loadToken}
      sx={{
        p: 3,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        background: "background.paper",
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            連携アプリ用アクセストークン
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
            外部サービス連携で使用するトークンを取得します
          </Typography>
        </Box>

        <TextField
          label="Provider ID"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          helperText="例: google, github"
        />

        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? "取得中..." : "トークンを取得"}
        </Button>

        {error ? <Alert severity="warning">{error}</Alert> : null}

        <TextField
          label="アクセストークン"
          value={token}
          multiline
          minRows={4}
          slotProps={{ input: { readOnly: true } }}
          placeholder="ここにトークンが表示されます"
        />
      </Stack>
    </Box>
  );
}