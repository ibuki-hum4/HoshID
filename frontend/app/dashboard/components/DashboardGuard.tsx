"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { DEFAULT_AUTH_ORIGIN } from "../lib/http";
import { useStoredState } from "../lib/storage";

type DashboardGuardProps = {
  children: ReactNode;
};

type SessionResponse = {
  session: unknown;
  user: unknown;
} | null;

export default function DashboardGuard({ children }: DashboardGuardProps) {
  const router = useRouter();
  const [authOrigin] = useStoredState("hoshid.authOrigin", DEFAULT_AUTH_ORIGIN);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      setChecking(true);
      try {
        const response = await fetch(`${authOrigin}/api/auth/get-session`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("unauthorized");
        }
        const payload = (await response.json()) as SessionResponse;
        if (!payload?.session || !payload.user) {
          throw new Error("unauthorized");
        }
        if (active) {
          setChecking(false);
        }
      } catch {
        if (active) {
          router.replace("/sign-in");
        }
      }
    };

    void verifySession();

    return () => {
      active = false;
    };
  }, [authOrigin, router]);

  if (checking) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: role="status" is the WAI-ARIA loading-indicator pattern; <output> is for calculated form results, not loading state.
      <Box
        role="status"
        aria-live="polite"
        sx={{ py: 10, textAlign: "center" }}
      >
        <CircularProgress size={28} aria-hidden="true" />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          セッションを確認しています...
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
