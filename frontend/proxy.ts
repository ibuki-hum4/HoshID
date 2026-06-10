import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type SessionResponse = {
  session?: {
    id: string;
    token: string;
    expiresAt: string;
  } | null;
  user?: {
    id: string;
    email: string;
  } | null;
};

async function readSession(
  request: NextRequest,
): Promise<SessionResponse | null> {
  const response = await fetch(new URL("/api/auth/get-session", request.url), {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SessionResponse;
}

function redirectToSignIn(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/sign-in";
  redirectUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  const session = await readSession(request);

  if (!session?.session || !session.user?.id) {
    return redirectToSignIn(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
