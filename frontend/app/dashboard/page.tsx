"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import MetricCard from "./components/MetricCard";
import PageHeader from "./components/PageHeader";
import { DEFAULT_API_ORIGIN, readErrorMessage } from "./lib/http";
import { useDashboardAuth } from "./components/DashboardAuthProvider";
import { useStoredState } from "./lib/storage";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  status: string;
};

type Announcement = {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type Member = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
};

type MemberRequest = {
  id: string;
  applicantEmail: string;
  applicantName?: string;
  status?: string;
  createdAt?: string;
};

export default function DashboardOverviewPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { apiToken, authToken, isAdmin, loading: sessionLoading } = useDashboardAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [apiError, setApiError] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setApiError("");
      setAuthError("");

      try {
        if (!sessionLoading && apiToken) {
          const [meRes, annRes] = await Promise.all([
            fetch(`${apiOrigin}/api/protected/me`, {
              headers: { Authorization: `Bearer ${apiToken}` },
            }),
            fetch(`${apiOrigin}/api/protected/announcements`, {
              headers: { Authorization: `Bearer ${apiToken}` },
            }),
          ]);

          if (!meRes.ok) {
            throw new Error(await readErrorMessage(meRes));
          }
          if (!annRes.ok) {
            throw new Error(await readErrorMessage(annRes));
          }

          const mePayload = (await meRes.json()) as MeResponse;
          const annPayload = (await annRes.json()) as { announcements: Announcement[] };
          if (active) {
            setMe(mePayload);
            setAnnouncements(annPayload.announcements ?? []);
          }
        }
      } catch (caught) {
        if (active) {
          setApiError(caught instanceof Error ? caught.message : "Failed to load API data.");
        }
      }

      try {
        if (!sessionLoading && authToken && isAdmin) {
          const [membersRes, requestsRes] = await Promise.all([
            fetch(`${apiOrigin}/api/admin/users`, {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch(`${apiOrigin}/api/admin/requests`, {
              headers: { Authorization: `Bearer ${authToken}` },
            }),
          ]);

          if (!membersRes.ok) {
            throw new Error(await readErrorMessage(membersRes));
          }
          if (!requestsRes.ok) {
            throw new Error(await readErrorMessage(requestsRes));
          }

          const membersPayload = (await membersRes.json()) as { users: Member[] };
          const requestsPayload = (await requestsRes.json()) as { requests: MemberRequest[] };
          const users = membersPayload.users ?? [];
          if (active) {
            setMembers(users);
            setRequests(requestsPayload.requests ?? []);
          }
        }
      } catch (caught) {
        if (active) {
          setAuthError(caught instanceof Error ? caught.message : "Failed to load auth data.");
        }
      }

      if (active) {
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [apiOrigin, apiToken, authToken, isAdmin, sessionLoading]);

  return (
    <Stack spacing={4}>
      <PageHeader
        title="Overview"
        subtitle="A quick look at announcements, members, and approvals."
        action={
          <Button component={NextLink} href="/dashboard/settings" variant="outlined">
            Connection settings
          </Button>
        }
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <MetricCard
          label="Announcements"
          value={loading ? "--" : String(announcements.length)}
          helper="Published in the protected feed"
        />
        {isAdmin ? (
          <MetricCard
            label="Members"
            value={loading ? "--" : String(members.length)}
            helper="Approved and pending accounts"
          />
        ) : null}
        {isAdmin ? (
          <MetricCard
            label="Pending requests"
            value={loading ? "--" : String(requests.length)}
            helper="Need admin approval"
          />
        ) : null}
      </Stack>

      <Stack spacing={2}>
        {apiError ? <Alert severity="warning">{apiError}</Alert> : null}
        {isAdmin && authError ? <Alert severity="warning">{authError}</Alert> : null}
      </Stack>

      <Divider />

      <Box
        sx={{
          p: 3,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          background: "background.paper",
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Signed-in profile
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
          {me ? me.email : "Not loaded"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Role: {me?.role || "-"} · Status: {me?.status || "-"}
        </Typography>
      </Box>
    </Stack>
  );
}
