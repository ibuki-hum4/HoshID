/**
 * Bit flags stored in `Role.permissionBitmask`. The literal "admin" role
 * (seeded in migrations, `isProtected: true`) always carries ALL_PERMISSIONS
 * so every existing `role === "admin"` check keeps working unchanged.
 */
export const PERMISSIONS = {
  MANAGE_USERS: 1 << 0,
  ASSIGN_ROLES: 1 << 1,
  MANAGE_ROLES: 1 << 2,
  MANAGE_APPLICATIONS: 1 << 3,
  MANAGE_ANNOUNCEMENTS: 1 << 4,
  MANAGE_REQUESTS: 1 << 5,
  VIEW_AUDIT_LOG: 1 << 6,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS: number = Object.values(PERMISSIONS).reduce(
  (mask, bit) => mask | bit,
  0,
);

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  MANAGE_USERS: "メンバー管理",
  ASSIGN_ROLES: "ロール割り当て",
  MANAGE_ROLES: "ロール定義の管理",
  MANAGE_APPLICATIONS: "アプリケーション管理",
  MANAGE_ANNOUNCEMENTS: "アナウンス管理",
  MANAGE_REQUESTS: "参加リクエストの承認",
  VIEW_AUDIT_LOG: "監査ログの閲覧",
};

export function hasPermissionBit(bitmask: number, bit: number): boolean {
  return (bitmask & bit) === bit;
}

export function hasAnyPermissionBit(bitmask: number, bits: number[]): boolean {
  return bits.some((bit) => hasPermissionBit(bitmask, bit));
}
