"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { hasPermissionBit } from "@/src/features/rbac/permissions";

import { DEFAULT_AUTH_ORIGIN, readErrorMessage } from "../lib/http";
import { useStoredState } from "../lib/storage";

type SessionUser = {
  id: string;
  email: string;
  customId?: string | null;
  uuid?: string | null;
  nickname?: string | null;
  githubUrl?: string | null;
  xUrl?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  birthday?: string | null;
  emailVerified?: boolean | null;
  role?: string | null;
  status?: string | null;
};

type DashboardAuthContextValue = {
  loading: boolean;
  error: string;
  sessionUser: SessionUser | null;
  role: string;
  status: string;
  authToken: string;
  isAdmin: boolean;
  permissions: number;
  hasPermission: (bit: number) => boolean;
};

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(
  null,
);

type DashboardAuthProviderProps = {
  children: ReactNode;
};

export function DashboardAuthProvider({
  children,
}: DashboardAuthProviderProps) {
  const [authOrigin] = useStoredState("hoshid.authOrigin", DEFAULT_AUTH_ORIGIN);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionRole, setSessionRole] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [dashboardToken, setDashboardToken] = useState("");
  const [permissions, setPermissions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      setSessionUser(null);
      setSessionRole("");
      setSessionStatus("");
      setDashboardToken("");
      setPermissions(0);

      try {
        const sessionResponse = await fetch(
          `${authOrigin}/api/auth/get-session`,
          {
            credentials: "include",
          },
        );
        if (!sessionResponse.ok) {
          if (active) {
            setLoading(false);
          }
          return;
        }

        const sessionPayload = (await sessionResponse.json()) as {
          user?: SessionUser;
        };
        const user = sessionPayload.user ?? null;
        if (!user?.id || !user.email) {
          if (active) {
            setLoading(false);
          }
          return;
        }

        const tokenResponse = await fetch(
          `${authOrigin}/session/dashboard-token`,
          {
            credentials: "include",
          },
        );
        if (!tokenResponse.ok) {
          throw new Error(await readErrorMessage(tokenResponse));
        }

        const tokenPayload = (await tokenResponse.json()) as {
          token?: string;
          role?: string;
          status?: string;
          permissions?: number;
        };

        if (active) {
          setSessionUser({
            ...user,
            role: tokenPayload.role ?? user.role ?? null,
            status: tokenPayload.status ?? user.status ?? null,
          });
          setSessionRole(tokenPayload.role ?? user.role ?? "");
          setSessionStatus(tokenPayload.status ?? user.status ?? "");
          setDashboardToken(tokenPayload.token ?? "");
          setPermissions(tokenPayload.permissions ?? 0);
          setLoading(false);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load dashboard session.",
          );
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authOrigin]);

  const role = sessionRole || (sessionUser?.role ?? "");
  const status = sessionStatus || (sessionUser?.status ?? "");

  return (
    <DashboardAuthContext.Provider
      value={{
        loading,
        error,
        sessionUser,
        role,
        status,
        authToken: dashboardToken,
        isAdmin: role === "admin" && status === "active",
        permissions,
        hasPermission: (bit: number) =>
          status === "active" && hasPermissionBit(permissions, bit),
      }}
    >
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const context = useContext(DashboardAuthContext);
  if (!context) {
    throw new Error(
      "useDashboardAuth must be used within DashboardAuthProvider",
    );
  }
  return context;
}
