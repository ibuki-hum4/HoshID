"use client";

import { AppWindow } from "lucide-react";
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
import { describeScope } from "@/lib/scopes";

import { revokeConsent } from "./actions";

type ConsentRow = {
  id: string;
  clientId: string;
  scopes: string[];
  createdAt: string;
};

export function ConnectedApps({ consents }: { consents: ConsentRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {consents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              連携中のアプリはありません
            </CardTitle>
            <CardDescription>
              アプリに HoshID でログインすると、ここに表示されます。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {consents.map((consent) => (
        <Card key={consent.id}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
                <AppWindow className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-medium break-all">
                  {consent.clientId}
                </CardTitle>
                <CardDescription>
                  {new Date(consent.createdAt).toLocaleDateString("ja-JP")} に許可
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {consent.scopes.map((scope) => (
                <Badge key={scope} variant="secondary">
                  {describeScope(scope).title}
                </Badge>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await revokeConsent(consent.id);
                  if (!result.ok) setError(result.message);
                })
              }
            >
              連携を解除
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
