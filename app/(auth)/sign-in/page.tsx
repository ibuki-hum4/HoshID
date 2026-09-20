import { Suspense } from "react";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "ログイン" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
