"use client";

import type { ReactNode, MouseEvent } from "react";
import { useMemo, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Chip,
  AppBar,
  Drawer,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Stack,
  Tooltip,
  Typography,
  useTheme,
  Menu,
  MenuItem,
  Avatar,
  ListItemIcon as MuiListItemIcon,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import RssFeedOutlinedIcon from "@mui/icons-material/RssFeedOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import TuneIcon from "@mui/icons-material/Tune";

import { useDashboardAuth } from "./DashboardAuthProvider";
import { DEFAULT_AUTH_ORIGIN } from "../lib/http";
import { useRouter } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  caption: string;
  adminOnly?: boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", caption: "Snapshot of the workspace", icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
  { label: "Announcements", href: "/dashboard/announcements", caption: "Broadcast updates", icon: <RssFeedOutlinedIcon fontSize="small" /> },
  { label: "Members", href: "/dashboard/members", caption: "Directory and status", icon: <PeopleAltOutlinedIcon fontSize="small" /> },
  { label: "Requests", href: "/dashboard/requests", caption: "Approve new members", adminOnly: true, icon: <TaskAltOutlinedIcon fontSize="small" /> },
  { label: "Applications", href: "/dashboard/applications", caption: "Intake pipeline", icon: <NoteAltOutlinedIcon fontSize="small" /> },
  { label: "Roles", href: "/dashboard/roles", caption: "Access control", icon: <ManageAccountsOutlinedIcon fontSize="small" /> },
  { label: "Profile", href: "/dashboard/profile", caption: "Your account", icon: <PersonOutlinedIcon fontSize="small" /> },
  { label: "Settings", href: "/dashboard/settings", caption: "Personal settings", icon: <TuneIcon fontSize="small" /> },
];

type DashboardShellProps = {
  children: ReactNode;
};

const DRAWER_WIDTH = 240;
const MINI_DRAWER_WIDTH = 72;

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const { isAdmin, sessionUser } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const drawerWidth = open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH;
  const router = useRouter();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);

  const handleLogout = async () => {
    handleMenuClose();
    try {
      await fetch(`${DEFAULT_AUTH_ORIGIN}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    router.replace("/sign-in");
  };

  const visibleItems = useMemo(
    () => (isAdmin ? navItems : navItems.filter((item) => !item.adminOnly)),
    [isAdmin],
  );

  const currentSection =
    visibleItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label ?? "Overview";

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        backgroundColor: "background.default",
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0)), radial-gradient(circle at top right, rgba(236,72,153,0.06), transparent 26%)",
        overflowX: "hidden",
      }}
    >
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          transition: theme.transitions.create(["width", "margin-left"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: "background.paper",
        }}
      >
        <Toolbar sx={{ minHeight: 64, gap: 1.5 }}>
          <IconButton
            aria-label={open ? "ナビゲーションを閉じる" : "ナビゲーションを開く"}
            edge="start"
            onClick={() => setOpen((current) => !current)}
            sx={{ color: "text.primary" }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexGrow: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: 4, color: "text.secondary" }}>
              HOSHID
            </Typography>
            <Chip label={currentSection} size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
            {isAdmin ? "Admin workspace" : "Member workspace"}
          </Typography>
          <Tooltip title="アカウントメニュー">
            <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }} size="small">
              <Avatar sx={{ width: 32, height: 32 }}>{sessionUser?.nickname?.[0]?.toUpperCase() ?? sessionUser?.email?.[0]?.toUpperCase() ?? "U"}</Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={menuOpen} onClose={handleMenuClose} keepMounted>
            <MenuItem onClick={() => { handleMenuClose(); router.push("/dashboard/settings"); }}>
              <MuiListItemIcon>
                <TuneIcon fontSize="small" />
              </MuiListItemIcon>
              設定
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); router.push("/dashboard/profile"); }}>
              <MuiListItemIcon>
                <PersonOutlinedIcon fontSize="small" />
              </MuiListItemIcon>
              プロフィールを編集
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                if (sessionUser?.id) router.push(`/dashboard/profile/${sessionUser.id}`);
              }}
            >
              <MuiListItemIcon>
                <VisibilityOutlinedIcon fontSize="small" />
              </MuiListItemIcon>
              プロフィールを表示
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <MuiListItemIcon>
                <LogoutIcon fontSize="small" />
              </MuiListItemIcon>
              ログアウト
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        open
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          whiteSpace: "nowrap",
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            overflowX: "hidden",
            boxSizing: "border-box",
            backgroundColor: "background.paper",
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          },
        }}
      >
        <Toolbar
          sx={{
            minHeight: 64,
            px: open ? 1.5 : 1,
            justifyContent: open ? "flex-start" : "center",
            alignItems: "center",
          }}
        >
          <Stack spacing={0.25} sx={{ display: open ? "grid" : "none" }}>
            <Typography variant="overline" sx={{ letterSpacing: 4, color: "text.secondary" }}>
              HOSHID
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
              Dashboard
            </Typography>
          </Stack>
        </Toolbar>

        <Divider />

        <Box sx={{ p: open ? 1.5 : 1, display: "flex", flexDirection: "column", gap: 2, height: "100%", overflow: "hidden" }}>

          <List disablePadding sx={{ display: "grid", gap: 0.5, overflowY: "auto", flexGrow: 1 }}>
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

              return (
                <Tooltip key={item.href} title={open ? "" : item.label} placement="right" disableHoverListener={open}>
                  <ListItemButton
                    component={NextLink}
                    href={item.href}
                    selected={active}
                    sx={{
                      minHeight: 48,
                      justifyContent: open ? "initial" : "center",
                      alignItems: "center",
                      px: open ? 1.5 : 1,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: active ? "primary.main" : "divider",
                      bgcolor: active ? "rgba(236, 72, 153, 0.08)" : "transparent",
                      "&.Mui-selected": {
                        bgcolor: "rgba(236, 72, 153, 0.08)",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "rgba(236, 72, 153, 0.12)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open ? 1.25 : 0,
                        ml: open ? 0 : 0.25,
                        justifyContent: "center",
                        color: active ? "primary.main" : "text.secondary",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {open ? (
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{item.label}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {item.caption}
                          </Typography>
                        }
                      />
                    ) : null}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>

          <Box sx={{ mt: "auto", borderTop: "1px solid", borderColor: "divider", pt: 1.5, display: open ? "block" : "none" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Current access
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {isAdmin ? "Admin" : "Member"}
            </Typography>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${drawerWidth}px`,
          transition: theme.transitions.create(["margin-left", "width"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          width: `calc(100% - ${drawerWidth}px)`,
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Box
            sx={{
              minHeight: "calc(100dvh - 96px)",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper",
              p: { xs: 2, md: 3 },
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
