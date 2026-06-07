import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    providerId?: string;
    accountId?: string;
    userId?: string;
  };

  if (!body.providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  const result = await auth.api.getAccessToken({
    body: {
      providerId: body.providerId,
      accountId: body.accountId,
      userId: body.userId,
    },
    headers: request.headers,
  });

  return NextResponse.json(result);
}