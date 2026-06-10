"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type ConsentResponse = {
  redirectURI?: string;
  redirect?: boolean;
  url?: string;
  error?: string;
};

export default function OidcAuthorizeClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const consentCode = searchParams.get("consent_code") ?? "";
  const clientId = searchParams.get("client_id") ?? "";
  const scope = searchParams.get("scope") ?? "openid";

  const scopes = useMemo(() => scope.split(/\s+/).filter(Boolean), [scope]);

  const submit = async (accept: boolean) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept,
          consent_code: consentCode || undefined,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ConsentResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Consent request failed.");
      }

      if (payload?.url) {
        router.replace(payload.url);
        return;
      }

      router.replace("/");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Consent request failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 3 }}
    >
      <Paper
        sx={{ width: "min(720px, 100%)", p: 4, borderRadius: 3 }}
        elevation={0}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              OIDC Consent
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
              {clientId || "Unknown client"}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              このアプリに付与するスコープを確認してください。
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {scopes.map((item) => (
              <Chip key={item} label={item} />
            ))}
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              onClick={() => submit(false)}
              disabled={loading}
            >
              Deny
            </Button>
            <Button
              variant="contained"
              onClick={() => submit(true)}
              disabled={loading}
            >
              {loading ? "Processing..." : "Allow"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
