"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Chip,
  Stack,
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

type User = {
  id: string;
  email: string;
  role: string;
  created_at?: string;
  updated_at?: string;
};

export default function RolesPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { apiToken, loading: sessionLoading } = useDashboardAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const columns: GridColDef<User>[] = [
    {
      field: "email",
      headerName: "Email",
      flex: 1.2,
      minWidth: 260,
    },
    {
      field: "role",
      headerName: "Role",
      width: 160,
      renderCell: (params) => <Chip label={String(params.value || "-")} size="small" variant="outlined" />,
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

  useEffect(() => {
    const load = async () => {
      if (sessionLoading || !apiToken) {
        setLoading(false);
        return;
      }
      setError("");
      setLoading(true);

      const response = await fetch(`${apiOrigin}/api/admin/users`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as { users: User[] };
      setUsers(payload.users ?? []);
      setLoading(false);
    };

    void load();
  }, [apiOrigin, apiToken, sessionLoading]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Roles"
        subtitle="Review role assignments managed by the admin API."
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Typography variant="body2" color="text.secondary">
        権限の変化を一覧で追えるように、行ソートとページングを有効にしています。
      </Typography>

      <DataGrid
        autoHeight
        rows={users}
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

      {!loading && users.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No users found.
        </Typography>
      ) : null}
    </Stack>
  );
}
