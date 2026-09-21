import { Suspense } from "react";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "新しいパスワード" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
