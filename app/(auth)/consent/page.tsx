import { Suspense } from "react";

import { ConsentForm } from "./consent-form";

export const metadata = { title: "アクセスの許可" };

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  );
}
