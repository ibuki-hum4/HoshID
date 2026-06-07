import type { ReactNode } from "react";
import ThemeRegistry from "./theme-registry";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return <ThemeRegistry>{children}</ThemeRegistry>;
}
