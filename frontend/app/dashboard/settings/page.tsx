"use client";

import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useDashboardAuth } from "../components/DashboardAuthProvider";
import PageHeader from "../components/PageHeader";
import { DEFAULT_AUTH_ORIGIN, readErrorMessage } from "../lib/http";

export default function SettingsPage() {
  const { sessionUser, loading: sessionLoading } = useDashboardAuth();
  const [birthday, setBirthday] = useState("");
  const [birthdayLocked, setBirthdayLocked] = useState(false);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (sessionUser?.birthday) {
      setBirthday(sessionUser.birthday);
      setBirthdayLocked(true);
    }
  }, [sessionUser]);

  const handleBirthdaySave = async () => {
    if (birthdayLocked) {
      return;
    }
    if (!birthday) {
      setError("生年月日を選択してください。");
      return;
    }

    setError("");
    setNotice("");
    setSavingBirthday(true);

    try {
      const response = await fetch(
        `${DEFAULT_AUTH_ORIGIN}/api/auth/update-user`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ birthday }),
        },
      );

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setBirthdayLocked(true);
      setNotice("生年月日を保存しました。以後は変更できません。");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "保存に失敗しました。",
      );
    } finally {
      setSavingBirthday(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!sessionUser?.email) {
      return;
    }

    setError("");
    setNotice("");
    setSecurityLoading(true);

    try {
      const response = await fetch(
        `${DEFAULT_AUTH_ORIGIN}/api/auth/send-verification-email`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: sessionUser.email,
            callbackURL: `${window.location.origin}/dashboard/settings`,
          }),
        },
      );

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setNotice("認証メールを送信しました。");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "送信に失敗しました。",
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!sessionUser?.email) {
      return;
    }

    setError("");
    setNotice("");
    setSecurityLoading(true);

    try {
      const response = await fetch(
        `${DEFAULT_AUTH_ORIGIN}/api/auth/request-password-reset`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: sessionUser.email,
            redirectTo: `${window.location.origin}/reset-password`,
          }),
        },
      );

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setNotice("パスワード再設定メールを送信しました。");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "送信に失敗しました。",
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="個人設定"
        subtitle="生年月日、メール認証、パスワード再設定を管理します。"
      />

      {error ? <Alert severity="warning">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          background: "background.paper",
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              アカウント
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
              {sessionUser?.email || "未読み込み"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              UUID: {sessionUser?.uuid || sessionUser?.id || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              メール確認: {sessionUser?.emailVerified ? "済み" : "未確認"}
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">
              生年月日
            </Typography>
            <TextField
              label="生年月日"
              type="date"
              value={birthday}
              onChange={(event) => setBirthday(event.target.value)}
              disabled={birthdayLocked}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={
                birthdayLocked
                  ? "一度設定したら変更できません。"
                  : "一度だけ保存できます。"
              }
              fullWidth
            />
            {!birthdayLocked ? (
              <Button
                variant="outlined"
                onClick={handleBirthdaySave}
                disabled={savingBirthday || sessionLoading}
                sx={{ alignSelf: "flex-start" }}
              >
                {savingBirthday ? "保存中..." : "生年月日を保存"}
              </Button>
            ) : null}
            {birthdayLocked ? (
              <Alert severity="info">保存済みの生年月日: {birthday}</Alert>
            ) : null}
          </Stack>

          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">
              セキュリティ
            </Typography>
            <Button
              variant="contained"
              onClick={sendVerificationEmail}
              disabled={
                securityLoading ||
                sessionLoading ||
                Boolean(sessionUser?.emailVerified)
              }
              sx={{ alignSelf: "flex-start" }}
            >
              {sessionUser?.emailVerified
                ? "メール確認済み"
                : "確認メールを送信"}
            </Button>
            <Button
              variant="outlined"
              onClick={requestPasswordReset}
              disabled={securityLoading || sessionLoading}
              sx={{ alignSelf: "flex-start" }}
            >
              パスワード再設定メールを送信
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
