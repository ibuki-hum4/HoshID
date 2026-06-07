"use client";

import type { ReactNode } from "react";
import { Box, Container, Divider, Paper, Stack, Typography } from "@mui/material";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        py: { xs: 3, md: 5 },
        px: 2,
        background:
          "linear-gradient(180deg, rgba(244, 246, 248, 0.96) 0%, rgba(237, 241, 245, 1) 100%)",
      }}
    >
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "0.95fr 1.05fr" },
            alignItems: "center",
            gap: { xs: 3, md: 4 },
          }}
        >
          <Stack
            spacing={2}
            sx={{
              px: { xs: 0, md: 2 },
              maxWidth: 560,
            }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 4 }}>
              HOSHID
            </Typography>
            <Typography variant="h2" component="h1" sx={{ lineHeight: 1.1 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 3,
              p: { xs: 3, md: 4 },
              backgroundColor: "background.paper",
              border: "1px solid #d8dee5",
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 2.5 }}>
                    AUTH PORTAL
                  </Typography>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                    {title}
                  </Typography>
                  {subtitle ? (
                    <Typography variant="body1" color="text.secondary">
                      {subtitle}
                    </Typography>
                  ) : null}
                </Stack>
                <Divider />
                {children}
                {footer ? <Box>{footer}</Box> : null}
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
