import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

import OidcAuthorizeClientPage from "./page-client";

export default function OidcAuthorizePage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <OidcAuthorizeClientPage />
    </Suspense>
  );
}
