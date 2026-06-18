"use client";

import AddIcon from "@mui/icons-material/Add";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ModeEditOutlineOutlinedIcon from "@mui/icons-material/ModeEditOutlineOutlined";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useState } from "react";

import {
  PERMISSION_LABELS,
  PERMISSIONS,
  type PermissionKey,
} from "@/src/features/rbac/permissions";

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
  isProtected: boolean;
};

type RoleForm = {
  name: string;
  customId: string;
  description: string;
  permissionBitmask: number;
};

const emptyForm: RoleForm = {
  name: "",
  customId: "",
  description: "",
  permissionBitmask: 0,
};

const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export default function RolesPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const {
    authToken,
    loading: sessionLoading,
    hasPermission,
  } = useDashboardAuth();
  const canManage = hasPermission(PERMISSIONS.MANAGE_ROLES);
  const canView = canManage || hasPermission(PERMISSIONS.ASSIGN_ROLES);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (sessionLoading || !canView || !authToken) {
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
  }, [apiOrigin, authToken, canView, sessionLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingRole(null);
    setForm(emptyForm);
    setFormError("");
  };

  const openEditDialog = (role: Role) => {
    setDialogMode("edit");
    setEditingRole(role);
    setForm({
      name: role.name,
      customId: role.customId,
      description: role.description,
      permissionBitmask: role.permissionBitmask,
    });
    setFormError("");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingRole(null);
    setForm(emptyForm);
    setFormError("");
  };

  const togglePermission = (bit: number) => {
    setForm((prev) => ({
      ...prev,
      permissionBitmask:
        (prev.permissionBitmask & bit) === bit
          ? prev.permissionBitmask & ~bit
          : prev.permissionBitmask | bit,
    }));
  };

  const submitForm = async () => {
    if (sessionLoading || !canManage || !authToken || !dialogMode) {
      return;
    }

    const name = form.name.trim();
    const customId = form.customId.trim();
    const description = form.description.trim();

    if (!name) {
      setFormError("ロール名を入力してください。");
      return;
    }
    if (!customId) {
      setFormError("カスタムIDを入力してください。");
      return;
    }

    setSaving(true);
    setFormError("");

    const url =
      dialogMode === "create"
        ? `${apiOrigin}/api/admin/roles`
        : `${apiOrigin}/api/admin/roles?id=${encodeURIComponent(editingRole?.id ?? "")}`;

    const response = await fetch(url, {
      method: dialogMode === "create" ? "POST" : "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        customId,
        description,
        permissionBitmask: form.permissionBitmask,
      }),
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
    if (!deleteTarget || sessionLoading || !canManage || !authToken) {
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
      renderCell: (params) =>
        canManage ? (
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
            <Tooltip
              title={
                params.row.isProtected
                  ? "組み込みロールは削除できません"
                  : "削除"
              }
            >
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={params.row.isProtected}
                  onClick={() => setDeleteTarget(params.row)}
                  aria-label="削除"
                >
                  <HighlightOffIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ) : null,
    },
    {
      field: "name",
      headerName: "ロール名",
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Typography variant="body2">{params.value}</Typography>
          {params.row.isProtected ? (
            <Tooltip title="組み込みロール">
              <LockOutlinedIcon fontSize="inherit" color="disabled" />
            </Tooltip>
          ) : null}
        </Stack>
      ),
    },
    {
      field: "customId",
      headerName: "カスタムID",
      flex: 0.7,
      minWidth: 140,
    },
    {
      field: "description",
      headerName: "説明",
      flex: 1.4,
      minWidth: 220,
    },
    {
      field: "permissionBitmask",
      headerName: "権限",
      flex: 1.6,
      minWidth: 260,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", py: 0.5 }}>
          {PERMISSION_KEYS.filter(
            (key) =>
              (params.row.permissionBitmask & PERMISSIONS[key]) ===
              PERMISSIONS[key],
          ).map((key) => (
            <Chip
              key={key}
              label={PERMISSION_LABELS[key]}
              size="small"
              variant="outlined"
            />
          ))}
          {params.row.permissionBitmask === 0 ? (
            <Typography variant="caption" color="text.secondary">
              なし
            </Typography>
          ) : null}
        </Stack>
      ),
    },
  ];

  if (sessionLoading || !canView) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="ロール管理"
        subtitle="システムのロール一覧を表示・管理します。各ロールに付与する権限はチェックボックスで設定できます。"
        action={
          canManage ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
            >
              新規作成
            </Button>
          ) : undefined
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
        getRowHeight={() => "auto"}
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
              disabled={Boolean(editingRole?.isProtected)}
              helperText={
                editingRole?.isProtected
                  ? "組み込みロールのカスタムIDは変更できません。"
                  : undefined
              }
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
            <Stack spacing={1}>
              <Typography variant="subtitle2">権限</Typography>
              <FormGroup>
                {PERMISSION_KEYS.map((key) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={
                          (form.permissionBitmask & PERMISSIONS[key]) ===
                          PERMISSIONS[key]
                        }
                        onChange={() => togglePermission(PERMISSIONS[key])}
                      />
                    }
                    label={PERMISSION_LABELS[key]}
                  />
                ))}
              </FormGroup>
            </Stack>
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
