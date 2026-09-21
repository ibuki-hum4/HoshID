import { hasPermission } from "@/lib/authorize";
import { requireApprovedUser } from "@/lib/session";

import { LoungeNav } from "./lounge-nav";
import { LoungeUserMenu } from "./lounge-user-menu";

export default async function LoungeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireApprovedUser();
  const adminHrefs = await visibleAdminHrefs();

  return (
    <div className="min-h-svh">
      <header className="glass sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <span className="text-lg font-semibold tracking-tight">HoshID</span>
          <div className="flex-1" />
          <LoungeUserMenu
            name={user.nickname || user.name}
            email={user.email}
            image={user.image}
          />
        </div>
      </header>

      <div className="mx-auto max-w-5xl gap-8 px-4 py-8 md:flex">
        <LoungeNav adminHrefs={adminHrefs} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/**
 * ナビに出す管理者向け項目を、実際の権限から決める。
 *
 * 隠すのは体裁でしかなく、防御は各ページの `requirePermission` が行う。
 * ここでやるのは「押せるのに 403 が返る項目」を並べないこと。
 */
async function visibleAdminHrefs(): Promise<string[]> {
  const [review, members, announcements, operations] = await Promise.all([
    hasPermission({ application: ["list"] }),
    hasPermission({ user: ["list"] }),
    hasPermission({ announcement: ["create"] }),
    hasPermission({ user: ["set-role"] }),
  ]);

  return [
    ...(review ? ["/lounge/admin", "/lounge/admin/guide"] : []),
    ...(members ? ["/lounge/admin/members"] : []),
    ...(announcements ? ["/lounge/admin/announcements"] : []),
    ...(operations
      ? ["/lounge/admin/webhooks", "/lounge/admin/audit", "/lounge/admin/keys"]
      : []),
  ];
}
