"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import type { IconType } from "react-icons";
import { FaGithub, FaInstagram, FaLink, FaXTwitter } from "react-icons/fa6";

import PageHeader from "../components/PageHeader";
import AccessTokenCard from "../components/AccessTokenCard";
import { useDashboardAuth } from "../components/DashboardAuthProvider";
import { DEFAULT_AUTH_ORIGIN, readErrorMessage } from "../lib/http";

type ProfileFormState = {
  nickname: string;
  githubUrl: string;
  xUrl: string;
  instagramUrl: string;
  websiteUrl: string;
};

type SocialKey = "githubUrl" | "xUrl" | "instagramUrl" | "websiteUrl";

type SocialRow = {
  id: string;
  platform: SocialKey;
  value: string;
};

type SocialOption = {
  key: SocialKey;
  label: string;
  helperText: string;
  placeholder: string;
  icon: IconType;
};

const socialOptions: SocialOption[] = [
  {
    key: "githubUrl",
    label: "GitHub",
    helperText: "https://github.com/your-name",
    placeholder: "https://github.com/your-name",
    icon: FaGithub,
  },
  {
    key: "xUrl",
    label: "X",
    helperText: "https://x.com/your-name",
    placeholder: "https://x.com/your-name",
    icon: FaXTwitter,
  },
  {
    key: "instagramUrl",
    label: "Instagram",
    helperText: "https://instagram.com/your-name",
    placeholder: "https://instagram.com/your-name",
    icon: FaInstagram,
  },
  {
    key: "websiteUrl",
    label: "Website",
    helperText: "個人サイトやポートフォリオ",
    placeholder: "https://example.com",
    icon: FaLink,
  },
];

const socialOptionMap = Object.fromEntries(
  socialOptions.map((option) => [option.key, option]),
) as Record<SocialKey, SocialOption>;

const createSocialRow = (platform: SocialKey, value = ""): SocialRow => ({
  id: `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  platform,
  value,
});

const buildInitialRows = (source: ProfileFormState): SocialRow[] => {
  const populated = socialOptions
    .map((option) => createSocialRow(option.key, source[option.key]?.trim() ?? ""))
    .filter((row) => row.value.length > 0);

  if (populated.length > 0) {
    return populated;
  }

  return [createSocialRow("githubUrl")];
};

const emptyForm: ProfileFormState = {
  nickname: "",
  githubUrl: "",
  xUrl: "",
  instagramUrl: "",
  websiteUrl: "",
};

export default function ProfilePage() {
  const { sessionUser, loading: sessionLoading } = useDashboardAuth();
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [socialRows, setSocialRows] = useState<SocialRow[]>([createSocialRow("githubUrl")]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!sessionUser) {
      return;
    }

    const nextForm: ProfileFormState = {
      nickname: sessionUser.nickname ?? "",
      githubUrl: sessionUser.githubUrl ?? "",
      xUrl: sessionUser.xUrl ?? "",
      instagramUrl: sessionUser.instagramUrl ?? "",
      websiteUrl: sessionUser.websiteUrl ?? "",
    };

    setForm(nextForm);
    setSocialRows(buildInitialRows(nextForm));
  }, [sessionUser]);

  const updateField = (key: keyof ProfileFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const updateSocialPlatform = (rowId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextPlatform = event.target.value as SocialKey;

    setSocialRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, platform: nextPlatform } : row)),
    );
  };

  const updateSocialValue = (rowId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    setSocialRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, value: nextValue } : row)),
    );
  };

  const addSocialRow = () => {
    setSocialRows((current) => {
      const used = new Set(current.map((row) => row.platform));
      const candidate = socialOptions.find((option) => !used.has(option.key));

      if (!candidate) {
        return current;
      }

      return [...current, createSocialRow(candidate.key)];
    });
  };

  const removeSocialRow = (rowId: string) => {
    setSocialRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      if (next.length > 0) {
        return next;
      }

      return [createSocialRow("githubUrl")];
    });
  };

  const handleSave = async () => {
    setError("");
    setNotice("");
    setSaving(true);

    const normalizedLinks: Record<SocialKey, string> = {
      githubUrl: "",
      xUrl: "",
      instagramUrl: "",
      websiteUrl: "",
    };

    for (const row of socialRows) {
      normalizedLinks[row.platform] = row.value.trim();
    }

    try {
      const response = await fetch(`${DEFAULT_AUTH_ORIGIN}/api/auth/update-user`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          githubUrl: normalizedLinks.githubUrl,
          xUrl: normalizedLinks.xUrl,
          instagramUrl: normalizedLinks.instagramUrl,
          websiteUrl: normalizedLinks.websiteUrl,
        }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setNotice("プロフィールを保存しました。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Profile"
        subtitle="ニックネームとSNSリンクを管理します。"
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
              Account
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
              {sessionUser?.customId || sessionUser?.email || "Not loaded"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mail: {sessionUser?.email || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              UUID: {sessionUser?.uuid || "-"}
            </Typography>
          </Box>

          <Stack spacing={2}>
            <TextField
              label="Nickname"
              value={form.nickname}
              onChange={updateField("nickname")}
              helperText="画面に表示する名前"
              fullWidth
            />

            <Stack spacing={1.25}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  SNS / Links
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addSocialRow}
                  disabled={socialRows.length >= socialOptions.length}
                >
                  Add
                </Button>
              </Stack>

              {socialRows.map((row) => {
                const option = socialOptionMap[row.platform];
                const usedByOthers = new Set(
                  socialRows
                    .filter((candidate) => candidate.id !== row.id)
                    .map((candidate) => candidate.platform),
                );
                const PlatformIcon = option.icon;

                return (
                  <Stack
                    key={row.id}
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    sx={{ alignItems: { md: "stretch" } }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 56,
                        height: 56,
                        border: "1px solid",
                        borderColor: "divider",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 1,
                        color: "text.secondary",
                      }}
                    >
                      <PlatformIcon size={18} />
                    </Box>

                    <TextField
                      select
                      label="Service"
                      value={row.platform}
                      onChange={updateSocialPlatform(row.id)}
                      sx={{ minWidth: { xs: "100%", md: 180 } }}
                    >
                      {socialOptions.map((candidate) => (
                        <MenuItem
                          key={candidate.key}
                          value={candidate.key}
                          disabled={usedByOthers.has(candidate.key)}
                        >
                          {candidate.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label={`${option.label} URL`}
                      value={row.value}
                      onChange={updateSocialValue(row.id)}
                      helperText={option.helperText}
                      placeholder={option.placeholder}
                      fullWidth
                    />

                    <IconButton
                      aria-label={`${option.label} を削除`}
                      onClick={() => removeSocialRow(row.id)}
                      sx={{
                        alignSelf: { xs: "flex-end", md: "stretch" },
                        width: 56,
                        height: 56,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <HighlightOffIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || sessionLoading}
            sx={{ alignSelf: "flex-start" }}
          >
            {saving ? "保存中..." : "Save profile"}
          </Button>
        </Stack>
      </Paper>

      <AccessTokenCard />
    </Stack>
  );
}
