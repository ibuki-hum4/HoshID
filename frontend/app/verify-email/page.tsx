"use client";

import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

const errorMessages: Record<string, string> = {
  TOKEN_EXPIRED: "確認リンクの有効期限が切れています。再度確認メールを送信してください。",
  INVALID_TOKEN: "確認リンクが無効です。再度確認メールを送信してください。",
  USER_NOT_FOUND: "対象のアカウントが見つかりませんでした。",
};

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [redirectTo, setRedirectTo] = useState("");

  useEffect(() => {
    let active = true;

    const evaluate = async () => {
      if (errorCode) {
        if (!active) return;
        setStatus("error");
        setMessage(errorMessages[errorCode] ?? "メールアドレスの確認に失敗しました。");
        return;
      }

      const session = await authClient.getSession();
      if (!active) return;

      if (session.data?.user?.emailVerified) {
        setStatus("success");
        setMessage("メールアドレスが確認されました。");
        setRedirectTo("/dashboard");
      } else {
        setStatus("success");
        setMessage("メールアドレスの確認が完了しました。サインインしてご利用ください。");
        setRedirectTo("/sign-in");
      }
    };

    void evaluate();

    return () => {
      active = false;
    };
  }, [errorCode]);

  useEffect(() => {
    if (status !== "success" || !redirectTo) {
      return;
    }

    const timer = setTimeout(() => {
      window.location.href = redirectTo;
    }, 3000);

    return () => clearTimeout(timer);
  }, [status, redirectTo]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 400, width: "100%" }}>
        <Typography variant="h4" align="center">
          メールアドレス確認
        </Typography>

        {status === "loading" && (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        )}

        {status === "success" && <Alert severity="success">{message}</Alert>}

        {status === "error" && <Alert severity="error">{message}</Alert>}

        <Typography variant="body2" color="text.secondary" align="center">
          {status === "loading" && "確認中..."}
          {status === "success" && "まもなくページを移動します"}
          {status === "error" && ""}
        </Typography>
      </Stack>
    </Box>
  );
}
