import type { SxProps, Theme } from "@mui/material/styles";

export const dashboardGridSx: SxProps<Theme> = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  bgcolor: "background.paper",
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "#f1f4f7",
    borderBottomColor: "divider",
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight: 800,
  },
  "& .MuiDataGrid-cell": {
    borderBottomColor: "divider",
    alignItems: "center",
  },
  "& .MuiDataGrid-footerContainer": {
    borderTopColor: "divider",
  },
  "& .MuiDataGrid-row:hover": {
    backgroundColor: "rgba(236, 72, 153, 0.04)",
  },
};
