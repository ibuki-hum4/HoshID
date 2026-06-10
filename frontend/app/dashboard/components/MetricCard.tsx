import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
};

export default function MetricCard({
  label,
  value,
  helper,
  icon,
}: MetricCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        border: "1px solid #f6d7e6",
        background: "background.paper",
        display: "grid",
        gap: 1.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {icon ? icon : null}
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
      </Box>
      <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      {helper ? (
        <Typography variant="body2" color="text.secondary">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}
