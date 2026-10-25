"use client";

import { AppWindow, BadgeCheck, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { parseScopes } from "@/lib/scopes";

import {
  deleteApp,
  rotateAppSecret,
  setAppDisabled,
  setClientAdminDisabled,
  setClientVerified,
  updateRedirectUris,
} from "./actions";
import { POST_LOGOUT_DESCRIPTION, RedirectUriFields } from "./redirect-uri-fields";
import { SecretReveal } from "./secret-reveal";

type AppRow = {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  enableEndSession: boolean;
  postLogoutRedirectUris: string[];
  scope: string;
  isPublic: boolean;
  requirePkce: boolean;
  disabled: boolean;
  /** 管理者が止めたかどうか。true の間は所有者が再開できない。 */
  adminDisabled: boolean;
  /** 管理者向けの一覧でのみ入る所有者名。 */
  owner: string | null;
  /** 管理者向けの一覧でのみ入る検証状態。自分のアプリ一覧では null。 */
  verified: boolean | null;
};

export function AppList({
  clients,
  title,
  description,
  emptyMessage,
  deletable = true,
  variant = "owner",
}: {
  clients: AppRow[];
  title: string;
  description?: string;
  emptyMessage: string;
  deletable?: boolean;
  /**
   * owner: 所有者としての操作（停止・URI 編集・シークレット再発行）。
   * admin: 管理者としての停止だけ。他人のアプリの URI やシークレットは
   * Better Auth が所有者以外に触らせない。
   */
  variant?: "owner" | "admin";
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AppRow | null>(null);
  const [rotating, setRotating] = useState<AppRow | null>(null);
  const [rotated, setRotated] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);
  const [editing, setEditing] = useState<AppRow | null>(null);
  const [editUris, setEditUris] = useState<string[]>([]);
  const [editEndSession, setEditEndSession] = useState(false);
  const [editPostLogoutUris, setEditPostLogoutUris] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleDisabled(client: AppRow, disabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result =
        variant === "admin"
          ? await setClientAdminDisabled(client.clientId, disabled)
          : await setAppDisabled(client.clientId, disabled);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {clients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>{emptyMessage}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {clients.map((client) => (
        <Card key={client.clientId}>
          <CardHeader className={cn(client.disabled && "opacity-60")}>
            <div className="flex items-start gap-3">
              <div className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
                <AppWindow className="size-5" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-medium">
                  {client.clientName ?? "(名前なし)"}
                </CardTitle>
                <CardDescription className="font-mono text-xs break-all">
                  {client.clientId}
                </CardDescription>
                {client.owner ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    所有者: {client.owner}
                  </p>
                ) : null}
              </div>

              {deletable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="このアプリを削除"
                  disabled={pending}
                  onClick={() => setDeleting(client)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {client.disabled ? (
                <Badge variant="destructive">
                  {client.adminDisabled ? "停止中（管理者）" : "停止中"}
                </Badge>
              ) : null}
              <Badge variant="secondary">
                {client.isPublic ? "パブリック" : "コンフィデンシャル"}
              </Badge>
              {client.verified ? (
                <Badge variant="default" className="gap-1 rounded-full">
                  <BadgeCheck className="size-3" aria-hidden />
                  検証済み
                </Badge>
              ) : null}
              {client.requirePkce ? null : (
                <Badge variant="destructive">
                  PKCE 無効
                </Badge>
              )}
              {parseScopes(client.scope).map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>

            {client.disabled ? (
              <p className="text-muted-foreground text-xs">
                停止中のため、このアプリからのログインもトークンの更新もできません。
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Switch
                id={`disable-${variant}-${client.clientId}`}
                checked={variant === "admin" ? client.adminDisabled : client.disabled}
                disabled={pending || (variant === "owner" && client.adminDisabled)}
                onCheckedChange={(checked) => toggleDisabled(client, checked)}
              />
              <label htmlFor={`disable-${variant}-${client.clientId}`} className="text-sm">
                {variant === "admin" ? "管理者として停止する" : "一時停止する"}
                <span className="text-muted-foreground block text-xs">
                  {variant === "admin"
                    ? "所有者は自分で再開できなくなります。不正なアプリを止めるときに。"
                    : client.adminDisabled
                      ? "管理者が停止しています。再開は管理者に問い合わせてください。"
                      : "アプリを消さずに、ログインを一時的に止めます。"}
                </span>
              </label>
            </div>

            {client.verified !== null ? (
              <div className="flex items-center gap-2">
                <Switch
                  id={`verify-${client.clientId}`}
                  checked={client.verified}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      const result = await setClientVerified(client.clientId, checked);
                      if (!result.ok) setError(result.message);
                    })
                  }
                />
                <label htmlFor={`verify-${client.clientId}`} className="text-sm">
                  検証済みにする
                  <span className="text-muted-foreground block text-xs">
                    同意画面の警告が消え、バッジが付きます。実体を確かめてから。
                  </span>
                </label>
              </div>
            ) : null}

            <div>
              <p className="text-muted-foreground text-xs">リダイレクト URI</p>
              <ul className="mt-1 space-y-0.5">
                {client.redirectUris.map((uri) => (
                  <li key={uri} className="font-mono text-xs break-all">
                    {uri}
                  </li>
                ))}
              </ul>
            </div>

            {client.enableEndSession && client.postLogoutRedirectUris.length > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs">ログアウト後の戻り先</p>
                <ul className="mt-1 space-y-0.5">
                  {client.postLogoutRedirectUris.map((uri) => (
                    <li key={uri} className="font-mono text-xs break-all">
                      {uri}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {variant === "owner" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setEditUris(client.redirectUris.length > 0 ? client.redirectUris : [""]);
                    setEditEndSession(client.enableEndSession);
                    setEditPostLogoutUris(
                      client.postLogoutRedirectUris.length > 0
                        ? client.postLogoutRedirectUris
                        : [""],
                    );
                    setEditError(null);
                    setEditing(client);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                  戻り先を編集
                </Button>
                {client.isPublic ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setRotating(client)}
                  >
                    <KeyRound className="size-4" aria-hidden />
                    シークレットを再発行
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {rotated ? (
        <SecretReveal
          clientId={rotated.clientId}
          clientSecret={rotated.clientSecret}
          onClose={() => setRotated(null)}
          title="シークレットを再発行しました"
          description="アプリ側の設定を新しいシークレットに差し替えてください。"
        />
      ) : null}

      <Dialog
        open={rotating !== null}
        onOpenChange={(open) => {
          if (!open) setRotating(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シークレットを再発行します</DialogTitle>
            <DialogDescription>
              {rotating?.clientName ?? rotating?.clientId} の今のシークレットは、すぐに
              使えなくなります。接続中のアプリは新しいシークレットに差し替えるまで
              ログインできなくなります。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRotating(null)}>
              やめる
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = rotating;
                if (!target) return;
                startTransition(async () => {
                  const result = await rotateAppSecret(target.clientId);
                  setRotating(null);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setRotated({ clientId: target.clientId, clientSecret: result.clientSecret });
                });
              }}
            >
              再発行する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>戻り先を編集</DialogTitle>
            <DialogDescription>
              {editing?.clientName ?? editing?.clientId} の戻り先を変更します。保存した
              時点から、一覧にない URI への戻りは拒否されます。
            </DialogDescription>
          </DialogHeader>

          {editError ? (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          ) : null}

          <RedirectUriFields value={editUris} onChange={setEditUris} />

          <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium">アプリからのログアウト</p>
              <p className="text-muted-foreground text-xs">
                アプリ側の操作で HoshID のセッションも終了できるようにします。
              </p>
            </div>
            <Switch
              checked={editEndSession}
              disabled={pending}
              onCheckedChange={setEditEndSession}
              aria-label="アプリからのログアウト"
            />
          </div>

          {editEndSession ? (
            <RedirectUriFields
              value={editPostLogoutUris}
              onChange={setEditPostLogoutUris}
              label="ログアウト後の戻り先"
              description={POST_LOGOUT_DESCRIPTION}
              required={false}
            />
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              やめる
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                const target = editing;
                if (!target) return;
                setEditError(null);
                startTransition(async () => {
                  const result = await updateRedirectUris(target.clientId, {
                    redirectUris: editUris,
                    endSession: editEndSession,
                    postLogoutRedirectUris: editPostLogoutUris,
                  });
                  if (!result.ok) {
                    setEditError(result.message);
                    return;
                  }
                  setEditing(null);
                });
              }}
            >
              {pending ? "保存しています…" : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アプリを削除します</DialogTitle>
            <DialogDescription>
              {deleting?.clientName ?? deleting?.clientId} を削除します。このアプリを
              使っている人は次のログインから入れなくなり、発行済みのトークンも
              無効になります。元に戻せません。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
            >
              やめる
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                startTransition(async () => {
                  const result = await deleteApp(target.clientId);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setDeleting(null);
                });
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
