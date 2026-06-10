"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import {
  Alert,
  Box,
  Chip,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef, type GridRowModel } from "@mui/x-data-grid";

import PageHeader from "../components/PageHeader";
import { useDashboardAuth } from "../components/DashboardAuthProvider";
import { dashboardGridSx } from "../components/dashboardGridStyles";
import {
  DEFAULT_API_ORIGIN,
  formatDateTime,
  readErrorMessage,
} from "../lib/http";
import { useStoredState } from "../lib/storage";

type Member = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const statusOptions = ["all", "active", "suspended", "archived"];
const memberStatusOptions: string[] = ["active", "suspended", "archived"];
const memberRoleOptions: string[] = ["user", "admin"];

function statusColor(status?: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "suspended":
      return "warning" as const;
    case "archived":
      return "default" as const;
    default:
      return "default" as const;
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "archived":
      return "Archived";
    default:
      return String(status ?? "active");
  }
}

function toEditableText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeMemberRow(row: Member): Member {
  return {
    ...row,
    displayUsername: toEditableText(row.displayUsername),
    username: toEditableText(row.username),
    role: toEditableText(row.role) || "user",
    status: toEditableText(row.status) || "active",
  };
}

function areMemberRowsEqual(left: Member, right: Member) {
  return (
    toEditableText(left.displayUsername) === toEditableText(right.displayUsername) &&
    toEditableText(left.username) === toEditableText(right.username) &&
    toEditableText(left.role) === toEditableText(right.role) &&
    toEditableText(left.status) === toEditableText(right.status)
  );
}

export default function MembersPage() {
  const router = useRouter();
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { authToken, loading: sessionLoading } = useDashboardAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [draftMembers, setDraftMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);

  const hasDraftChanges = draftMembers.length !== members.length
    ? true
    : draftMembers.some((row, index) => !areMemberRowsEqual(row, members[index]));

  const dirtyMemberIds = new Set(
    draftMembers.filter((row, index) => !areMemberRowsEqual(row, members[index])).map((row) => row.id),
  );

  const handleProcessRowUpdate = (newRow: GridRowModel<Member>) => {
    const normalized = normalizeMemberRow(newRow);

    setDraftMembers((current) => current.map((row) => (row.id === normalized.id ? normalized : row)));

    return normalized;
  };

  const handleRevertDraft = () => {
    setDraftMembers(members.map((row) => ({ ...row })));
    setError("");
  };

  const handleSaveDraft = async () => {
    if (!hasDraftChanges) {
      return;
    }

    setSavingDraft(true);
    setError("");

    try {
      const nextMembers = [...members];
      for (let index = 0; index < draftMembers.length; index += 1) {
        const draftRow = draftMembers[index];
        const currentRow = members[index];

        if (!currentRow || areMemberRowsEqual(draftRow, currentRow)) {
          continue;
        }

        const changedFields: Record<string, string> = {};
        if (toEditableText(draftRow.displayUsername) !== toEditableText(currentRow.displayUsername)) {
          changedFields.displayName = toEditableText(draftRow.displayUsername);
        }
        if (toEditableText(draftRow.username) !== toEditableText(currentRow.username)) {
          changedFields.customId = toEditableText(draftRow.username);
        }
        if (toEditableText(draftRow.role) !== toEditableText(currentRow.role)) {
          changedFields.role = toEditableText(draftRow.role);
        }
        if (toEditableText(draftRow.status) !== toEditableText(currentRow.status)) {
          changedFields.status = toEditableText(draftRow.status);
        }

        const response = await fetch(`${apiOrigin}/api/admin/users/${draftRow.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(changedFields),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const payload = (await response.json()) as { member?: Member };
        nextMembers[index] = normalizeMemberRow(payload.member ?? draftRow);
      }

      setMembers(nextMembers);
      setDraftMembers(nextMembers.map((row) => ({ ...row })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存に失敗しました。");
    } finally {
      setSavingDraft(false);
    }
  };

  const columns: GridColDef<Member>[] = [
    {
      field: "actions",
      headerName: "操作",
      width: 124,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="詳細を表示">
            <IconButton
              size="small"
              onClick={() => router.push(`/dashboard/profile/${encodeURIComponent(params.row.id)}`)}
              aria-label="詳細を表示"
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="履歴を表示">
            <IconButton
              size="small"
              onClick={() => setError(`履歴の表示はまだ未接続です: ${params.row.email}`)}
              aria-label="履歴を表示"
            >
              <HistoryOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton
              size="small"
              color="error"
              onClick={() => setError(`削除操作はまだ未接続です: ${params.row.email}`)}
              aria-label="削除"
            >
              <HighlightOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
    {
      field: "displayUsername",
      headerName: "表示名",
      flex: 0.9,
      minWidth: 160,
      editable: true,
      valueGetter: (_, row) => row.displayUsername || row.name || "-",
    },
    {
      field: "username",
      headerName: "カスタムID",
      flex: 0.8,
      minWidth: 150,
      editable: true,
      valueGetter: (_, row) => row.username || row.id,
    },
    {
      field: "email",
      headerName: "メールアドレス",
      flex: 1.15,
      minWidth: 240,
    },
    {
      field: "role",
      headerName: "権限",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: [...memberRoleOptions],
      valueGetter: (_, row) => row.role || "user",
      renderCell: (params) => <Chip label={String(params.value || "user")} size="small" variant="outlined" />,
    },
    {
      field: "status",
      headerName: "ステータス",
      width: 136,
      editable: true,
      type: "singleSelect",
      valueOptions: [...memberStatusOptions],
      renderCell: (params) => (
        <Chip
          label={statusLabel(String(params.value || "active"))}
          color={statusColor(String(params.value || "active"))}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "updatedAt",
      headerName: "更新日時",
      flex: 0.9,
      minWidth: 180,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "createdAt",
      headerName: "作成日時",
      flex: 0.9,
      minWidth: 180,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
  ];

  useEffect(() => {
    const load = async () => {
      if (sessionLoading || !authToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const suffix = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const response = await fetch(`${apiOrigin}/api/admin/users${suffix}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as { users: Member[] };
      const nextMembers = (payload.users ?? []).map(normalizeMemberRow);
      setMembers(nextMembers);
      setDraftMembers(nextMembers.map((row) => ({ ...row })));
      setLoading(false);
    };

    void load();
  }, [apiOrigin, authToken, sessionLoading, statusFilter]);

  return (
    <Stack spacing={3}>
      <PageHeader title="メンバー管理" subtitle="登録済みメンバーの一覧表示・絞り込み・編集を行います。" />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, flexWrap: "wrap" }}>
          <TextField
            select
            label="ステータスで絞り込み"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ maxWidth: 220 }}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            ソート、検索、ページネーションでメンバーを素早く確認できます。
          </Typography>
        </Stack>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={`合計 ${members.length} 件`} variant="outlined" />
          <Chip label={statusFilter === "all" ? "全ステータス" : statusFilter} variant="outlined" />
          {hasDraftChanges ? <Chip label="変更あり" color="warning" variant="outlined" /> : null}
          <Button variant="outlined" onClick={handleRevertDraft} disabled={!hasDraftChanges || savingDraft}>
            変更をもとに戻す
          </Button>
          <Button variant="contained" onClick={handleSaveDraft} disabled={!hasDraftChanges || savingDraft}>
            {savingDraft ? "保存中..." : "変更を保存"}
          </Button>
        </Box>
      </Stack>

      <DataGrid
        autoHeight
        rows={draftMembers}
        columns={columns}
        loading={loading}
        editMode="cell"
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25]}
        slots={{ toolbar: GridToolbar }}
        processRowUpdate={handleProcessRowUpdate}
        onProcessRowUpdateError={(caught) => setError(caught instanceof Error ? caught.message : "保存に失敗しました。")}
        getRowClassName={(params) => (dirtyMemberIds.has(params.id as string) ? "member-draft-row" : "")}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
          sorting: { sortModel: [{ field: "updatedAt", sort: "desc" }] },
        }}
        sx={{
          ...dashboardGridSx,
          minWidth: 0,
          "& .MuiDataGrid-toolbarContainer": {
            px: 1,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          },
          "& .MuiDataGrid-toolbarContainer .MuiButton-root": {
            borderRadius: 1,
          },
        }}
      />

      {!loading && members.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          メンバーが見つかりません。
        </Typography>
      ) : null}
    </Stack>
  );
}
