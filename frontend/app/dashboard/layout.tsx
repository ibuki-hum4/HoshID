import type { ReactNode } from "react";
import { DashboardAuthProvider } from "./components/DashboardAuthProvider";
import DashboardGuard from "./components/DashboardGuard";
import DashboardShell from "./components/DashboardShell";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardAuthProvider>
      <DashboardGuard>
        <DashboardShell>{children}</DashboardShell>
      </DashboardGuard>
    </DashboardAuthProvider>
  );
}
