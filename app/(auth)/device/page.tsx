import { Suspense } from "react";

import { DeviceForm } from "./device-form";

export const metadata = { title: "機器の確認" };

export default function DevicePage() {
  return (
    <Suspense>
      <DeviceForm />
    </Suspense>
  );
}
