import { Suspense } from "react";

import { ApplyForm } from "./apply-form";

export const metadata = { title: "アカウント申請" };

export default function ApplyPage() {
  return (
    <Suspense>
      <ApplyForm />
    </Suspense>
  );
}
