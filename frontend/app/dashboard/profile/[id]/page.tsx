import { Box, Link, Paper, Stack, Typography } from "@mui/material";
import PageHeader from "../../components/PageHeader";
import { DEFAULT_AUTH_ORIGIN } from "../../lib/http";

type Params = { params: Promise<{ id: string }> };
type PublicUser = {
  customId?: string;
  nickname?: string;
  email?: string;
  websiteUrl?: string;
  githubUrl?: string;
  xUrl?: string;
  instagramUrl?: string;
};

export default async function PublicProfilePage({ params }: Params) {
  const { id } = await params;

  let user: PublicUser | null = null;

  try {
    const res = await fetch(`${DEFAULT_AUTH_ORIGIN}/public/users/${id}`, {
      // cache for a short time
      next: { revalidate: 60 },
    });

    if (res.ok) {
      user = (await res.json()) as PublicUser;
    }
  } catch (_e) {
    // ignore and render not found / error state
  }

  if (!user) {
    return (
      <Stack spacing={3}>
        <PageHeader title="Profile" subtitle="公開プロフィール" />

        <Paper elevation={0} sx={{ p: 3, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
          <Typography>プロフィールが見つかりませんでした。</Typography>
        </Paper>
      </Stack>
    );
  }

  const { customId, nickname, email, websiteUrl, githubUrl, xUrl, instagramUrl } = user;

  return (
    <Stack spacing={3}>
      <PageHeader title="Profile" subtitle="公開プロフィール" />

      <Paper elevation={0} sx={{ p: 3, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {customId || nickname || email || "Unnamed"}
          </Typography>

          {email ? (
            <Typography color="text.secondary">Mail: {email}</Typography>
          ) : null}

          <Box>
            {websiteUrl ? (
              <div>
                <Link href={websiteUrl} target="_blank" rel="noopener noreferrer">
                  Link: {websiteUrl}
                </Link>
              </div>
            ) : null}

            {githubUrl ? (
              <div>
                <Link href={githubUrl} target="_blank" rel="noopener noreferrer">
                  Github: {githubUrl}
                </Link>
              </div>
            ) : null}

            {xUrl ? (
              <div>
                <Link href={xUrl} target="_blank" rel="noopener noreferrer">
                  X: {xUrl}
                </Link>
              </div>
            ) : null}

            {instagramUrl ? (
              <div>
                <Link href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  Instagram: {instagramUrl}
                </Link>
              </div>
            ) : null}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
