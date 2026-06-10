"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import PageHeader from "../components/PageHeader";
import { useDashboardAuth } from "../components/DashboardAuthProvider";
import { dashboardGridSx } from "../components/dashboardGridStyles";
import {
  DEFAULT_API_ORIGIN,
  formatDateTime,
  readErrorMessage,
} from "../lib/http";
import { useStoredState } from "../lib/storage";

type Announcement = {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

const statusOptions = ["active", "inactive", "archived"];

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "inactive":
      return "warning" as const;
    case "archived":
      return "default" as const;
    default:
      return "default" as const;
  }
}

export default function AnnouncementsPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { authToken, loading: sessionLoading } = useDashboardAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  const columns: GridColDef<Announcement>[] = [
    {
      field: "title",
      headerName: "Title",
      flex: 1.2,
      minWidth: 260,
    },
    {
      field: "status",
      headerName: "Status",
      width: 150,
      renderCell: (params) => (
        <Chip label={String(params.value || "-")} color={statusColor(String(params.value || ""))} size="small" variant="outlined" />
      ),
    },
    {
      field: "updated_at",
      headerName: "Updated",
      flex: 0.8,
      minWidth: 180,
      valueGetter: (_, row) => row.updated_at || row.created_at || "",
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
  ];

  const load = async () => {
    if (sessionLoading || !authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    let response = await fetch(`${apiOrigin}/api/admin/announcements`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok && response.status === 403) {
      setAdminMode(false);
      response = await fetch(`${apiOrigin}/api/protected/announcements`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { announcements: Announcement[] };
    setAnnouncements(payload.announcements ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [apiOrigin, authToken, sessionLoading]);

  const handleCreate = async () => {
    if (sessionLoading || !authToken) {
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");

    const response = await fetch(`${apiOrigin}/api/admin/announcements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: title.trim(), status }),
    });

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setSaving(false);
      return;
    }

    setTitle("");
    setStatus("active");
    await load();
    setSaving(false);
  };

  return (
    <Stack spacing={4}>
      <PageHeader
        title="Announcements"
        subtitle="Manage the broadcast feed used by the protected API."
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          New announcement
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            disabled={!adminMode}
          />
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ minWidth: 160 }}
            disabled={!adminMode}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!adminMode || saving}
            sx={{ minWidth: 160 }}
          >
            {saving ? "Saving..." : "Create"}
          </Button>
        </Stack>
        {!adminMode ? (
          <Alert severity="info">Admin permissions are required to create announcements.</Alert>
        ) : null}
      </Stack>

      <Divider />

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Recent announcements
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sort and paginate to browse previously published announcements.
        </Typography>
        <DataGrid
          autoHeight
          rows={announcements}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
            sorting: { sortModel: [{ field: "updated_at", sort: "desc" }] },
          }}
          sx={dashboardGridSx}
        />
        {!loading && announcements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No announcements yet.
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
