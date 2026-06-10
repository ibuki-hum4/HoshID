"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
      <Stack spacing={3} sx={{ alignItems: "center" }}>
        <CircularProgress />
        <Typography variant="h5">セットアップが完了しました</Typography>
        <Typography variant="body2" color="text.secondary">
          ダッシュボードにリダイレクトしています...
        </Typography>
      </Stack>
    </Box>
  );
}
