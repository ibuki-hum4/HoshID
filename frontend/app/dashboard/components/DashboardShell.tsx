"use client";

import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import RssFeedOutlinedIcon from "@mui/icons-material/RssFeedOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ListItemIcon as MuiListItemIcon,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { PERMISSIONS } from "@/src/features/rbac/permissions";
import { DEFAULT_AUTH_ORIGIN } from "../lib/http";
import { useDashboardAuth } from "./DashboardAuthProvider";

type NavItem = {
  label: string;
  href: string;
  caption: string;
  requiredPermissions?: number[];
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "ホーム",
    href: "/dashboard",
    caption: "ワークスペースの概要",
    icon: <SpaceDashboardOutlinedIcon fontSize="small" />,
  },
  {
    label: "アナウンス",
    href: "/dashboard/announcements",
    caption: "お知らせの配信",
    icon: <RssFeedOutlinedIcon fontSize="small" />,
  },
  {
    label: "メンバー",
    href: "/dashboard/members",
    caption: "一覧とステータス",
    icon: <PeopleAltOutlinedIcon fontSize="small" />,
  },
  {
    label: "リクエスト",
    href: "/dashboard/requests",
    caption: "新規メンバーの承認",
    requiredPermissions: [PERMISSIONS.MANAGE_REQUESTS],
    icon: <TaskAltOutlinedIcon fontSize="small" />,
  },
  {
    label: "アプリケーション",
    href: "/dashboard/applications",
    caption: "OAuth / OIDC クライアント",
    requiredPermissions: [PERMISSIONS.MANAGE_APPLICATIONS],
    icon: <NoteAltOutlinedIcon fontSize="small" />,
  },
  {
    label: "ロール",
    href: "/dashboard/roles",
    caption: "アクセス制御",
    requiredPermissions: [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.ASSIGN_ROLES],
    icon: <ManageAccountsOutlinedIcon fontSize="small" />,
  },
  {
    label: "プロフィール",
    href: "/dashboard/profile",
    caption: "あなたのアカウント",
    icon: <PersonOutlinedIcon fontSize="small" />,
  },
  {
    label: "設定",
    href: "/dashboard/settings",
    caption: "個人設定",
    icon: <TuneIcon fontSize="small" />,
  },
];

type DashboardShellProps = {
  children: ReactNode;
};

const DRAWER_WIDTH = 240;
const MINI_DRAWER_WIDTH = 72;

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const { isAdmin, sessionUser, hasPermission } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const drawerWidth = open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH;
  const router = useRouter();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) =>
    setMenuAnchor(e.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);

  const handleLogout = async () => {
    handleMenuClose();
    try {
      await fetch(`${DEFAULT_AUTH_ORIGIN}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    router.replace("/sign-in");
  };

  const visibleItems = useMemo(
    () =>
      navItems.filter(
        (item) =>
          !item.requiredPermissions ||
          item.requiredPermissions.some((bit) => hasPermission(bit)),
      ),
    [hasPermission],
  );

  const currentSection =
    visibleItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "ホーム";

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
            aria-label={
              open ? "ナビゲーションを閉じる" : "ナビゲーションを開く"
            }
            edge="start"
            onClick={() => setOpen((current) => !current)}
            sx={{ color: "text.primary" }}
          >
            <MenuIcon />
          </IconButton>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", flexGrow: 1 }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 4, color: "text.secondary" }}
            >
              HOSHID
            </Typography>
            <Chip label={currentSection} size="small" variant="outlined" />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            {isAdmin ? "管理者ワークスペース" : "メンバーワークスペース"}
          </Typography>
          <Tooltip title="アカウントメニュー">
            <IconButton
              onClick={handleMenuOpen}
              sx={{ ml: 1 }}
              size="small"
              aria-label="アカウントメニュー"
              aria-haspopup="menu"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {sessionUser?.nickname?.[0]?.toUpperCase() ??
                  sessionUser?.email?.[0]?.toUpperCase() ??
                  "U"}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={handleMenuClose}
            keepMounted
          >
            <MenuItem
              onClick={() => {
                handleMenuClose();
                router.push("/dashboard/settings");
              }}
            >
              <MuiListItemIcon>
                <TuneIcon fontSize="small" />
              </MuiListItemIcon>
              設定
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                router.push("/dashboard/profile");
              }}
            >
              <MuiListItemIcon>
                <PersonOutlinedIcon fontSize="small" />
              </MuiListItemIcon>
              プロフィールを編集
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                if (sessionUser?.id)
                  router.push(`/dashboard/profile/${sessionUser.id}`);
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
            <Typography
              variant="overline"
              sx={{ letterSpacing: 4, color: "text.secondary" }}
            >
              HOSHID
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 800, lineHeight: 1 }}
            >
              ダッシュボード
            </Typography>
          </Stack>
        </Toolbar>

        <Divider />

        <Box
          sx={{
            p: open ? 1.5 : 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <List
            component="nav"
            aria-label="メインナビゲーション"
            disablePadding
            sx={{ display: "grid", gap: 0.5, overflowY: "auto", flexGrow: 1 }}
          >
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Tooltip
                  key={item.href}
                  title={open ? "" : item.label}
                  placement="right"
                  disableHoverListener={open}
                >
                  <ListItemButton
                    component={NextLink}
                    href={item.href}
                    selected={active}
                    aria-current={active ? "page" : undefined}
                    sx={{
                      minHeight: 48,
                      justifyContent: open ? "initial" : "center",
                      alignItems: "center",
                      px: open ? 1.5 : 1,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: active ? "primary.main" : "divider",
                      bgcolor: active
                        ? "rgba(236, 72, 153, 0.08)"
                        : "transparent",
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
                        primary={
                          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {item.label}
                          </Typography>
                        }
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

          <Box
            sx={{
              mt: "auto",
              borderTop: "1px solid",
              borderColor: "divider",
              pt: 1.5,
              display: open ? "block" : "none",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              現在のアクセス権限
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {isAdmin ? "管理者" : "メンバー"}
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
