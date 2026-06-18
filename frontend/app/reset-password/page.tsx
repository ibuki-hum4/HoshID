"use client";

import { Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import AuthShell from "../components/auth/AuthShell";
import ResetPasswordView from "./ResetPasswordView";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="パスワードリセット"
          subtitle="新しいパスワードを設定します。"
        >
          <Typography variant="body2" color="text.secondary">
            読み込み中...
          </Typography>
        </AuthShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return <ResetPasswordView token={token} />;
}
