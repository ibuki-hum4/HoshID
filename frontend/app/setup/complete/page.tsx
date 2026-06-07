"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, CircularProgress, Stack } from "@mui/material";

export default function SetupCompletePage() {
  const router = useRouter();

  useEffect(() => {
    // 3秒後にダッシュボードにリダイレクト
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={3} alignItems="center">
        <CircularProgress />
        <Typography variant="h5">セットアップが完了しました</Typography>
        <Typography variant="body2" color="text.secondary">
          ダッシュボードにリダイレクトしています...
        </Typography>
      </Stack>
    </Box>
  );
}
