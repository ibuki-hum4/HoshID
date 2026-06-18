"use client";

import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

type MemberRequest = {
  id: string;
  status?: string;
  applicantEmail: string;
  applicantName?: string;
  requestedUsername?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const {
    authToken,
    loading: sessionLoading,
    hasPermission,
  } = useDashboardAuth();
  const canManage = hasPermission(PERMISSIONS.MANAGE_REQUESTS);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<MemberRequest | null>(
    null,
  );
  const [approveEmail, setApproveEmail] = useState("");
  const [approveUsername, setApproveUsername] = useState("");
  const [approvePassword, setApprovePassword] = useState("");
  const [approveConfirm, setApproveConfirm] = useState("");
  const [approveError, setApproveError] = useState("");

  const load = useCallback(async () => {
    if (sessionLoading || !canManage || !authToken) {
      return;
    }
    setError("");
    setLoading(true);

    const response = await fetch(`${apiOrigin}/api/admin/requests`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) {
      setError(await readErrorMessage(response));
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { requests: MemberRequest[] };
    setRequests(payload.requests ?? []);
    setLoading(false);
  }, [apiOrigin, authToken, canManage, sessionLoading]);

  useEffect(() => {
    if (!sessionLoading && !canManage) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [canManage, router, sessionLoading, load]);

  const handleReject = async (id: string) => {
    if (sessionLoading || !canManage || !authToken) {
      return;
    }
    setLoadingId(id);
    setError("");

    const response = await fetch(
      `${apiOrigin}/api/admin/requests/${id}/reject`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    if (!response.ok) {
      setError(await readErrorMessage(response));
      setLoadingId(null);
      return;
    }

    await load();
    setLoadingId(null);
  };

  const openApproveDialog = (request: MemberRequest) => {
    setApproveTarget(request);
    setApproveEmail(request.applicantEmail);
    setApproveUsername(request.requestedUsername || "");
    setApprovePassword("");
    setApproveConfirm("");
    setApproveError("");
  };

  const closeApproveDialog = () => {
    setApproveTarget(null);
    setApproveEmail("");
    setApproveUsername("");
    setApprovePassword("");
    setApproveConfirm("");
    setApproveError("");
  };

  const submitApproval = async () => {
    if (!approveTarget || sessionLoading || !canManage || !authToken) {
      return;
    }

    if (!approveEmail) {
      setApproveError("ログイン用メールアドレスを入力してください。");
      return;
    }
    if (!approvePassword) {
      setApproveError("初期パスワードを入力してください。");
      return;
    }
    if (approvePassword !== approveConfirm) {
      setApproveError("パスワードが一致しません。");
      return;
    }

    setLoadingId(approveTarget.id);
    setApproveError("");

    const response = await fetch(
      `${apiOrigin}/api/admin/requests/${approveTarget.id}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: approveEmail,
          username: approveUsername.trim() || undefined,
          password: approvePassword,
        }),
      },
    );

    if (!response.ok) {
      setApproveError(await readErrorMessage(response));
      setLoadingId(null);
      return;
    }

    await load();
    setLoadingId(null);
    closeApproveDialog();
  };

  const columns: GridColDef<MemberRequest>[] = [
    {
      field: "applicantEmail",
      headerName: "申請者のメール",
      flex: 1.1,
      minWidth: 240,
    },
    {
      field: "applicantName",
      headerName: "申請者の名前",
      flex: 0.8,
      minWidth: 160,
      valueGetter: (_, row) => row.applicantName || "-",
    },
    {
      field: "requestedUsername",
      headerName: "希望カスタムID",
      flex: 0.8,
      minWidth: 180,
      valueGetter: (_, row) => row.requestedUsername || "-",
    },
    {
      field: "status",
      headerName: "ステータス",
      width: 150,
      renderCell: () => (
        <Chip label="保留中" size="small" variant="outlined" color="warning" />
      ),
    },
    {
      field: "createdAt",
      headerName: "申請日時",
      flex: 0.9,
      minWidth: 180,
      valueGetter: (_, row) => row.createdAt || "",
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "actions",
      headerName: "操作",
      minWidth: 220,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ py: 1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => openApproveDialog(params.row)}
            disabled={loadingId === params.row.id}
          >
            承認
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => handleReject(params.row.id)}
            disabled={loadingId === params.row.id}
          >
            却下
          </Button>
        </Stack>
      ),
    },
  ];

  if (sessionLoading || !canManage) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="リクエスト"
        subtitle="保留中のメンバー申請を承認・却下します。"
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Typography variant="body2" color="text.secondary">
        ページ内でソートとページネーションを使いながら、保留中の申請を処理できます。
      </Typography>

      <DataGrid
        autoHeight
        rows={requests}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
          sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
        }}
        sx={dashboardGridSx}
      />

      {!loading && requests.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          保留中のリクエストはありません。
        </Typography>
      ) : null}

      <Dialog
        open={Boolean(approveTarget)}
        onClose={closeApproveDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>リクエストを承認</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              申請者: {approveTarget?.applicantEmail || "-"}
            </Typography>
            <TextField
              label="ログイン用メールアドレス"
              type="email"
              value={approveEmail}
              onChange={(event) => setApproveEmail(event.target.value)}
              fullWidth
              required
            />
            <TextField
              label="カスタムID（任意）"
              value={approveUsername}
              onChange={(event) => setApproveUsername(event.target.value)}
              fullWidth
              helperText="3〜30文字の半角英数字、._ のみ使用できます。空欄の場合は未設定のまま承認されます。"
            />
            <TextField
              label="初期パスワード"
              type="password"
              value={approvePassword}
              onChange={(event) => setApprovePassword(event.target.value)}
              fullWidth
              required
            />
            <TextField
              label="初期パスワード（確認）"
              type="password"
              value={approveConfirm}
              onChange={(event) => setApproveConfirm(event.target.value)}
              fullWidth
              required
            />
            {approveError ? (
              <Alert severity="warning">{approveError}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeApproveDialog} color="inherit">
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={submitApproval}
            disabled={loadingId === approveTarget?.id}
          >
            {loadingId === approveTarget?.id ? "送信中..." : "承認して送信"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
