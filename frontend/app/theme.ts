import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { jaJP } from "@mui/x-data-grid/locales";

const shadows = Array(25).fill("none") as ThemeOptions["shadows"];

// Neutral, modern base palette. Pink is reserved for the brand accent
// (primary actions, active/selected states, focus rings) rather than
// washed across backgrounds, borders, and body text.
const neutral = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  500: "#64748b",
  600: "#475569",
  900: "#0f172a",
};

const focusRingColor = "#ec4899";

const theme = createTheme(
  {
    palette: {
      mode: "light",
      primary: {
        main: "#ec4899",
        dark: "#db2777",
        light: "#f9a8d4",
        contrastText: "#ffffff",
      },
      secondary: {
        main: "#0f172a",
        dark: "#020617",
        contrastText: "#ffffff",
      },
      background: {
        default: neutral[50],
        paper: "#ffffff",
      },
      text: {
        primary: neutral[900],
        secondary: neutral[600],
      },
      divider: neutral[200],
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
      // A little roundness, not pill-shaped: modern without being bubbly.
      borderRadius: 10,
    },
    shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // WCAG 2.4.7: always show a clear, high-contrast focus indicator
          // for keyboard users, even where a component overrides its own
          // shadow/outline.
          "*:focus-visible": {
            outline: `2px solid ${focusRingColor}`,
            outlineOffset: "2px",
          },
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.001ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.001ms !important",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            boxShadow: "none",
            border: `1px solid ${neutral[200]}`,
            backgroundImage: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            backgroundImage: "none",
            borderBottom: `1px solid ${neutral[200]}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            boxShadow: "none",
            backgroundImage: "none",
            borderRight: `1px solid ${neutral[200]}`,
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
            borderRadius: 999,
            fontWeight: 700,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
      MuiTooltip: {
        defaultProps: {
          // Tooltips alone aren't a reliable accessible name source in
          // every AT/browser combination; components that rely on a
          // Tooltip for their label should also set an explicit
          // aria-label.
          enterTouchDelay: 0,
        },
      },
    },
  },
  // Localizes the MUI X Data Grid's built-in toolbar, column menu,
  // pagination, and "no rows" copy to Japanese.
  jaJP,
);

export default theme;
