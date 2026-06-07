import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const result = await auth.api.getJwks({ headers: request.headers });
  return NextResponse.json(result);
}
