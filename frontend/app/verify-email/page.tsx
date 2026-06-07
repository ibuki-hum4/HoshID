"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Typography, Alert, CircularProgress, Stack } from "@mui/material";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email) {
      setStatus("error");
      setMessage("メールアドレスが指定されていません。");
      return;
    }

    // メール確認完了
    // Better Auth が自動的に処理するか、
    // DB で emailVerified を更新
    setStatus("success");
    setMessage(`${email} のメールアドレスが確認されました。`);

    // 3秒後にダッシュボードにリダイレクト
    const timer = setTimeout(() => {
      window.location.href = "/dashboard";
    }, 3000);

    return () => clearTimeout(timer);
  }, [email]);

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

        {status === "success" && (
          <Alert severity="success">{message}</Alert>
        )}

        {status === "error" && (
          <Alert severity="error">{message}</Alert>
        )}

        <Typography variant="body2" color="text.secondary" align="center">
          {status === "loading" && "確認中..."}
          {status === "success" && "ダッシュボードにリダイレクトします"}
          {status === "error" && ""}
        </Typography>
      </Stack>
    </Box>
  );
}
