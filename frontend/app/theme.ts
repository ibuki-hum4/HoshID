import { createTheme, type ThemeOptions } from "@mui/material/styles";

const shadows = Array(25).fill("none") as ThemeOptions["shadows"];

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#ec4899",
      dark: "#db2777",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#a21caf",
      dark: "#86198f",
      contrastText: "#ffffff",
    },
    background: {
      default: "#fdf2f8",
      paper: "#fffafc",
    },
    text: {
      primary: "#3f1d2e",
      secondary: "#9d6b85",
    },
    divider: "#f6d7e6",
  },
  typography: {
    fontFamily:
      'var(--font-inter), var(--font-noto-sans-jp), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 },
    h4: { fontWeight: 800 },
    h5: { fontWeight: 750 },
    h6: { fontWeight: 750 },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 2,
  },
  shadows,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          boxShadow: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          boxShadow: "none",
          border: "1px solid #f6d7e6",
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundImage: "none",
          borderBottom: "1px solid #f6d7e6",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          boxShadow: "none",
          backgroundImage: "none",
          borderRight: "1px solid #f6d7e6",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontWeight: 700,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
  },
});

export default theme;
