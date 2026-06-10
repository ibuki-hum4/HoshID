"use client";

import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/DashboardAuthProvider";
import PageHeader from "../../components/PageHeader";
import {
  DEFAULT_API_ORIGIN,
  formatDateTime,
  readErrorMessage,
} from "../../lib/http";
import { useStoredState } from "../../lib/storage";

type Member = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  emailVerified: boolean;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function MemberProfilePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [apiOrigin] = useStoredState("hoshid.apiOrigin", DEFAULT_API_ORIGIN);
  const { authToken, loading: sessionLoading } = useDashboardAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (sessionLoading || !authToken || !id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");

      const response = await fetch(
        `${apiOrigin}/api/admin/users/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );

      if (!response.ok) {
        setError(await readErrorMessage(response));
        setMember(null);
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as Member;
      setMember(payload);
      setLoading(false);
    };

    void load();
  }, [apiOrigin, authToken, id, sessionLoading]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="メンバー詳細"
        subtitle="メンバーのアカウント情報を表示します。"
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}

      {!loading && !member ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography>メンバーが見つかりませんでした。</Typography>
        </Paper>
      ) : null}

      {member ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {member.displayUsername || member.name}
            </Typography>

            <Stack direction="row" spacing={1}>
              <Chip
                label={`権限: ${member.role}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`ステータス: ${member.status}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={member.emailVerified ? "メール確認済み" : "メール未確認"}
                size="small"
                variant="outlined"
                color={member.emailVerified ? "success" : "default"}
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography color="text.secondary">
                メールアドレス: {member.email}
              </Typography>
              <Typography color="text.secondary">
                カスタムID: {member.username || member.id}
              </Typography>
              <Typography color="text.secondary">
                作成日時: {formatDateTime(member.createdAt)}
              </Typography>
              <Typography color="text.secondary">
                更新日時: {formatDateTime(member.updatedAt)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
