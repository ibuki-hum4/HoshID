"use client";

import AddIcon from "@mui/icons-material/Add";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import ModeEditOutlineOutlinedIcon from "@mui/icons-material/ModeEditOutlineOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useEffect, useState } from "react";

import { useDashboardAuth } from "../components/DashboardAuthProvider";
import { dashboardGridSx } from "../components/dashboardGridStyles";
import PageHeader from "../components/PageHeader";
import { DEFAULT_API_ORIGIN, readErrorMessage } from "../lib/http";
import { useStoredState } from "../lib/storage";

type Role = {
  id: string;
  name: string;
  customId: string;
  description: string;
  permissionBitmask: number;
};

type RoleForm = {
  name: string;
  customId: string;
  description: string;
  permissionBitmask: string;
};

const emptyForm: RoleForm = {
  name: "",
  customId: "",
  description: "",
  permissionBitmask: "0",
};

export default function RolesPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { authToken, isAdmin, loading: sessionLoading } = useDashboardAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (sessionLoading || !isAdmin || !authToken) {
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);

    const response = await fetch(`${apiOrigin}/api/admin/roles`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { roles: Role[] };
    setRoles(payload.roles ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [apiOrigin, authToken, isAdmin, sessionLoading]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const openEditDialog = (role: Role) => {
    setDialogMode("edit");
    setEditingId(role.id);
    setForm({
      name: role.name,
      customId: role.customId,
      description: role.description,
      permissionBitmask: String(role.permissionBitmask),
    });
    setFormError("");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const submitForm = async () => {
    if (sessionLoading || !isAdmin || !authToken || !dialogMode) {
      return;
    }

    const name = form.name.trim();
    const customId = form.customId.trim();
    const description = form.description.trim();
    const permissionBitmask = Number.parseInt(form.permissionBitmask, 10);

    if (!name) {
      setFormError("ロール名を入力してください。");
      return;
    }
    if (!customId) {
      setFormError("カスタムIDを入力してください。");
      return;
    }
    if (Number.isNaN(permissionBitmask)) {
      setFormError("権限ビットマスクは整数で入力してください。");
      return;
    }

    setSaving(true);
    setFormError("");

    const url =
      dialogMode === "create"
        ? `${apiOrigin}/api/admin/roles`
        : `${apiOrigin}/api/admin/roles?id=${encodeURIComponent(editingId ?? "")}`;

    const response = await fetch(url, {
      method: dialogMode === "create" ? "POST" : "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, customId, description, permissionBitmask }),
    });

    if (!response.ok) {
      setFormError(await readErrorMessage(response));
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    closeDialog();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || sessionLoading || !isAdmin || !authToken) {
      return;
    }

    setDeleting(true);
    setError("");

    const response = await fetch(
      `${apiOrigin}/api/admin/roles?id=${encodeURIComponent(deleteTarget.id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setDeleting(false);
      return;
    }

    await load();
    setDeleting(false);
    setDeleteTarget(null);
  };

  const columns: GridColDef<Role>[] = [
    {
      field: "actions",
      headerName: "操作",
      width: 110,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="編集">
            <IconButton
              size="small"
              onClick={() => openEditDialog(params.row)}
              aria-label="編集"
            >
              <ModeEditOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton
              size="small"
              color="error"
              onClick={() => setDeleteTarget(params.row)}
              aria-label="削除"
            >
              <HighlightOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
    {
      field: "name",
      headerName: "ロール名",
      flex: 1,
      minWidth: 200,
    },
    {
      field: "customId",
      headerName: "カスタムID",
      flex: 0.8,
      minWidth: 160,
    },
    {
      field: "description",
      headerName: "説明",
      flex: 1.6,
      minWidth: 280,
    },
    {
      field: "permissionBitmask",
      headerName: "権限ビットマスク",
      width: 160,
      align: "right",
      headerAlign: "right",
    },
  ];

  if (sessionLoading || !isAdmin) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="ロール管理"
        subtitle="システムのロール一覧を表示・管理します。ロール名をクリックして詳細を編集できます。"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            新規作成
          </Button>
        }
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <DataGrid
        autoHeight
        rows={roles}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        pageSizeOptions={[5, 10, 25]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
          sorting: { sortModel: [{ field: "name", sort: "asc" }] },
        }}
        sx={dashboardGridSx}
      />

      {!loading && roles.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ロールがまだ登録されていません。
        </Typography>
      ) : null}

      <Dialog
        open={dialogMode !== null}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {dialogMode === "create" ? "ロールを新規作成" : "ロールを編集"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="ロール名"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              fullWidth
              required
            />
            <TextField
              label="カスタムID"
              value={form.customId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, customId: event.target.value }))
              }
              fullWidth
              required
            />
            <TextField
              label="説明"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="権限ビットマスク"
              value={form.permissionBitmask}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  permissionBitmask: event.target.value,
                }))
              }
              fullWidth
              type="number"
            />
            {formError ? <Alert severity="warning">{formError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} color="inherit">
            キャンセル
          </Button>
          <Button variant="contained" onClick={submitForm} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ロールを削除</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            「{deleteTarget?.name}」を削除します。この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "削除中..." : "削除"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
