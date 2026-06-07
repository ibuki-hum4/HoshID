import { Box, Stack, Typography } from "@mui/material";

import PageHeader from "../components/PageHeader";

export default function ApplicationsPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Applications"
        subtitle="This section is ready once an intake API is available."
      />

      <Box
        sx={{
          p: 3,
          borderRadius: 1,
          border: "1px dashed",
          borderColor: "divider",
          background: "background.paper",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          No application endpoints yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The current API does not expose application or intake routes. Once the
          backend is defined, this page can list submissions and decision status.
        </Typography>
      </Box>
    </Stack>
  );
}
