import { Suspense } from "react";

import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "二段階認証" };

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  );
}
