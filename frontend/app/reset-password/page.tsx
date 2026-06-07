"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Typography } from "@mui/material";

import AuthShell from "../components/auth/AuthShell";
import ResetPasswordView from "./ResetPasswordView";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="パスワードリセット" subtitle="新しいパスワードを設定します。">
          <Typography variant="body2" color="text.secondary">
            Loading...
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
