"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Typography } from "@mui/material";

import AuthShell from "../../components/auth/AuthShell";
import ResetPasswordView from "../ResetPasswordView";

export default function ResetPasswordTokenPage() {
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
      <ResetPasswordTokenContent />
    </Suspense>
  );
}

function ResetPasswordTokenContent() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";

  return <ResetPasswordView token={token} />;
}
