"use client";

import AddIcon from "@mui/icons-material/Add";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import ModeEditOutlineOutlinedIcon from "@mui/icons-material/ModeEditOutlineOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useState } from "react";

import { OIDC_ALLOWED_SCOPES } from "@/src/features/oauth/config";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

import { useDashboardAuth } from "../components/DashboardAuthProvider";
import { dashboardGridSx } from "../components/dashboardGridStyles";
import PageHeader from "../components/PageHeader";
import {
  DEFAULT_API_ORIGIN,
  formatDateTime,
  readErrorMessage,
} from "../lib/http";
import { useStoredState } from "../lib/storage";

type OAuthClientRow = {
  clientId: string;
  clientName: string | null;
  type: string | null;
  disabled: boolean;
  public: boolean | null;
  hasSecret: boolean;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  grantTypes: string[];
  scope: string | null;
  tokenEndpointAuthMethod: string | null;
  skipConsent: boolean | null;
  enableEndSession: boolean | null;
  clientUri: string | null;
  contacts: string[];
  clientIdIssuedAt: number | null;
};

const grantTypeOptions = [
  { value: "authorization_code", label: "Authorization Code（認可コード）" },
  { value: "refresh_token", label: "Refresh Token（リフレッシュトークン）" },
  {
    value: "client_credentials",
    label: "Client Credentials（クライアント認証情報）",
  },
];

const authMethodOptions = [
  {
    value: "client_secret_basic",
    label: "client_secret_basic（機密クライアント）",
  },
  {
    value: "client_secret_post",
    label: "client_secret_post（機密クライアント）",
  },
  { value: "none", label: "none（公開クライアント・PKCE専用）" },
];

type ClientForm = {
  clientName: string;
  clientUri: string;
  redirectUris: string;
  postLogoutRedirectUris: string;
  contacts: string;
  scopes: string[];
  grantTypes: string[];
  tokenEndpointAuthMethod: string;
  skipConsent: boolean;
  enableEndSession: boolean;
  disabled: boolean;
};

const emptyForm: ClientForm = {
  clientName: "",
  clientUri: "",
  redirectUris: "",
  postLogoutRedirectUris: "",
  contacts: "",
  scopes: ["openid"],
  grantTypes: ["authorization_code", "refresh_token"],
  tokenEndpointAuthMethod: "client_secret_basic",
  skipConsent: false,
  enableEndSession: false,
  disabled: false,
};

function splitLines(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function ApplicationsPage() {
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const {
    authToken,
    loading: sessionLoading,
    hasPermission,
  } = useDashboardAuth();
  const canManage = hasPermission(PERMISSIONS.MANAGE_APPLICATIONS);

  const [clients, setClients] = useState<OAuthClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<OAuthClientRow | null>(
    null,
  );
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<OAuthClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<OAuthClientRow | null>(null);
  const [rotating, setRotating] = useState(false);

  const [secretReveal, setSecretReveal] = useState<{
    clientId: string;
    clientSecret: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    if (sessionLoading || !canManage || !authToken) {
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);

    const response = await fetch(`${apiOrigin}/api/admin/oauth/clients`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { clients: OAuthClientRow[] };
    setClients(payload.clients ?? []);
    setLoading(false);
  }, [apiOrigin, authToken, canManage, sessionLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingClient(null);
    setForm(emptyForm);
    setFormError("");
  };

  const openEditDialog = (client: OAuthClientRow) => {
    setDialogMode("edit");
    setEditingClient(client);
    setForm({
      clientName: client.clientName ?? "",
      clientUri: client.clientUri ?? "",
      redirectUris: client.redirectUris.join("\n"),
      postLogoutRedirectUris: client.postLogoutRedirectUris.join("\n"),
      contacts: client.contacts.join(", "),
      scopes: client.scope
        ? client.scope.split(" ").filter(Boolean)
        : ["openid"],
      grantTypes: client.grantTypes,
      tokenEndpointAuthMethod:
        client.tokenEndpointAuthMethod ?? "client_secret_basic",
      skipConsent: Boolean(client.skipConsent),
      enableEndSession: Boolean(client.enableEndSession),
      disabled: client.disabled,
    });
    setFormError("");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingClient(null);
    setForm(emptyForm);
    setFormError("");
  };

  const toggleListValue = (key: "scopes" | "grantTypes", value: string) => {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const submitForm = async () => {
    if (sessionLoading || !canManage || !authToken || !dialogMode) {
      return;
    }

    const clientName = form.clientName.trim();
    if (!clientName) {
      setFormError("アプリケーション名を入力してください。");
      return;
    }

    const redirectUris = splitLines(form.redirectUris);
    if (
      form.grantTypes.includes("authorization_code") &&
      redirectUris.length === 0
    ) {
      setFormError(
        "Authorization Code を使う場合はリダイレクトURIを1つ以上指定してください。",
      );
      return;
    }

    setSaving(true);
    setFormError("");

    const contacts = form.contacts
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const postLogoutRedirectUris = splitLines(form.postLogoutRedirectUris);

    const body =
      dialogMode === "create"
        ? {
            clientName,
            clientUri: form.clientUri || undefined,
            redirectUris,
            postLogoutRedirectUris,
            contacts,
            scopes: form.scopes,
            grantTypes: form.grantTypes,
            tokenEndpointAuthMethod: form.tokenEndpointAuthMethod,
            skipConsent: form.skipConsent,
            enableEndSession: form.enableEndSession,
            disabled: form.disabled,
          }
        : {
            clientName,
            clientUri: form.clientUri || "",
            redirectUris,
            postLogoutRedirectUris,
            contacts,
            scopes: form.scopes,
            grantTypes: form.grantTypes,
            skipConsent: form.skipConsent,
            enableEndSession: form.enableEndSession,
            disabled: form.disabled,
          };

    const url =
      dialogMode === "create"
        ? `${apiOrigin}/api/admin/oauth/clients`
        : `${apiOrigin}/api/admin/oauth/clients/${encodeURIComponent(editingClient?.clientId ?? "")}`;

    const response = await fetch(url, {
      method: dialogMode === "create" ? "POST" : "PATCH",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setFormError(await readErrorMessage(response));
      setSaving(false);
      return;
    }

    const payload = (await response.json()) as {
      client: OAuthClientRow;
      clientSecret?: string | null;
    };

    await load();
    setSaving(false);
    closeDialog();

    if (dialogMode === "create") {
      setSecretReveal({
        clientId: payload.client.clientId,
        clientSecret: payload.clientSecret ?? null,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || sessionLoading || !canManage || !authToken) {
      return;
    }

    setDeleting(true);
    setError("");

    const response = await fetch(
      `${apiOrigin}/api/admin/oauth/clients/${encodeURIComponent(deleteTarget.clientId)}`,
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

  const confirmRotate = async () => {
    if (!rotateTarget || sessionLoading || !canManage || !authToken) {
      return;
    }

    setRotating(true);
    setError("");

    const response = await fetch(
      `${apiOrigin}/api/admin/oauth/clients/${encodeURIComponent(rotateTarget.clientId)}/rotate-secret`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setRotating(false);
      return;
    }

    const payload = (await response.json()) as {
      client: OAuthClientRow;
      clientSecret: string;
    };

    await load();
    setRotating(false);
    setRotateTarget(null);
    setSecretReveal({
      clientId: payload.client.clientId,
      clientSecret: payload.clientSecret,
    });
  };

  const columns: GridColDef<OAuthClientRow>[] = [
    {
      field: "actions",
      headerName: "操作",
      width: 150,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="編集">
            <IconButton
              size="small"
              aria-label={`${params.row.clientName ?? params.row.clientId} を編集`}
              onClick={() => openEditDialog(params.row)}
            >
              <ModeEditOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              params.row.public
                ? "公開クライアントにはシークレットがありません"
                : "シークレットを再発行"
            }
          >
            <span>
              <IconButton
                size="small"
                aria-label={`${params.row.clientName ?? params.row.clientId} のシークレットを再発行`}
                disabled={Boolean(params.row.public)}
                onClick={() => setRotateTarget(params.row)}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton
              size="small"
              color="error"
              aria-label={`${params.row.clientName ?? params.row.clientId} を削除`}
              onClick={() => setDeleteTarget(params.row)}
            >
              <HighlightOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
    {
      field: "clientName",
      headerName: "アプリケーション名",
      flex: 1,
      minWidth: 200,
    },
    {
      field: "clientId",
      headerName: "クライアントID",
      flex: 1.2,
      minWidth: 220,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "tokenEndpointAuthMethod",
      headerName: "認証方式",
      width: 160,
    },
    {
      field: "grantTypes",
      headerName: "グラントタイプ",
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", py: 0.5 }}>
          {(params.value as string[]).map((value) => (
            <Chip key={value} label={value} size="small" variant="outlined" />
          ))}
        </Stack>
      ),
    },
    {
      field: "disabled",
      headerName: "状態",
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value ? "無効" : "有効"}
          color={params.value ? "default" : "success"}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "clientIdIssuedAt",
      headerName: "作成日時",
      flex: 0.8,
      minWidth: 180,
      renderCell: (params) =>
        formatDateTime(
          params.value ? new Date(Number(params.value) * 1000) : null,
        ),
    },
  ];

  if (sessionLoading || !canManage) {
    return (
      <Stack spacing={3}>
        <PageHeader
          title="アプリケーション"
          subtitle="このセクションはアプリケーション管理権限を持つメンバーのみ利用できます。"
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="アプリケーション"
        subtitle="HoshID を使って SSO するアプリケーション（OAuth / OIDC クライアント）を管理します。"
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
        rows={clients}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        getRowId={(row) => row.clientId}
        pageSizeOptions={[5, 10, 25]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
          sorting: { sortModel: [{ field: "clientIdIssuedAt", sort: "desc" }] },
        }}
        sx={dashboardGridSx}
      />

      {!loading && clients.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          登録済みのアプリケーションはありません。
        </Typography>
      ) : null}

      <Dialog
        open={dialogMode !== null}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {dialogMode === "create"
            ? "アプリケーションを登録"
            : "アプリケーションを編集"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="アプリケーション名"
              value={form.clientName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clientName: event.target.value }))
              }
              fullWidth
              required
            />
            <TextField
              label="アプリケーションURL（任意）"
              value={form.clientUri}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clientUri: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="リダイレクトURI（1行に1つ）"
              value={form.redirectUris}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  redirectUris: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="ログアウト後リダイレクトURI（任意・1行に1つ）"
              value={form.postLogoutRedirectUris}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  postLogoutRedirectUris: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={1}
            />
            <TextField
              label="連絡先メールアドレス（任意・カンマ区切り）"
              value={form.contacts}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contacts: event.target.value }))
              }
              fullWidth
            />

            <Divider />

            {dialogMode === "create" ? (
              <TextField
                select
                label="トークンエンドポイント認証方式"
                value={form.tokenEndpointAuthMethod}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    tokenEndpointAuthMethod: event.target.value,
                  }))
                }
                fullWidth
                helperText="作成後は変更できません。"
              >
                {authMethodOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="トークンエンドポイント認証方式"
                value={form.tokenEndpointAuthMethod}
                fullWidth
                disabled
              />
            )}

            <Stack spacing={1}>
              <Typography variant="subtitle2">グラントタイプ</Typography>
              <FormGroup row>
                {grantTypeOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        checked={form.grantTypes.includes(option.value)}
                        onChange={() =>
                          toggleListValue("grantTypes", option.value)
                        }
                      />
                    }
                    label={option.label}
                  />
                ))}
              </FormGroup>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">スコープ</Typography>
              <FormGroup row>
                {OIDC_ALLOWED_SCOPES.map((scope) => (
                  <FormControlLabel
                    key={scope}
                    control={
                      <Checkbox
                        checked={form.scopes.includes(scope)}
                        onChange={() => toggleListValue("scopes", scope)}
                      />
                    }
                    label={scope}
                  />
                ))}
              </FormGroup>
            </Stack>

            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.skipConsent}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        skipConsent: event.target.checked,
                      }))
                    }
                  />
                }
                label="同意画面をスキップ（信頼済みクライアント）"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enableEndSession}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        enableEndSession: event.target.checked,
                      }))
                    }
                  />
                }
                label="RP-Initiated Logout を許可"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.disabled}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        disabled: event.target.checked,
                      }))
                    }
                  />
                }
                label="無効化する"
              />
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
        <DialogTitle>アプリケーションを削除</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            「{deleteTarget?.clientName}
            」を削除します。このクライアントを使った既存のログインセッションは利用できなくなります。
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

      <Dialog
        open={Boolean(rotateTarget)}
        onClose={() => setRotateTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>シークレットを再発行</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            「{rotateTarget?.clientName}
            」の現在のシークレットは無効になり、このアプリケーションは新しいシークレットに更新するまでログインできなくなります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRotateTarget(null)} color="inherit">
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={confirmRotate}
            disabled={rotating}
          >
            {rotating ? "再発行中..." : "再発行"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(secretReveal)}
        onClose={() => setSecretReveal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>クライアントシークレット</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="warning">
              このシークレットは今しか表示されません。安全な場所に保存してください。
            </Alert>
            <TextField
              label="クライアントID"
              value={secretReveal?.clientId ?? ""}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
              sx={{ "& input": { fontFamily: "monospace" } }}
            />
            <TextField
              label="クライアントシークレット"
              value={
                secretReveal?.clientSecret ??
                "(公開クライアントのためシークレットはありません)"
              }
              fullWidth
              multiline
              slotProps={{ input: { readOnly: true } }}
              sx={{ "& textarea": { fontFamily: "monospace" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSecretReveal(null)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
