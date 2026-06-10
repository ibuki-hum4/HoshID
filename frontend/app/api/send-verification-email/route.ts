import { type NextRequest, NextResponse } from "next/server";

import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { auth } from "@/lib/auth";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateLimited =
      (await enforceRateLimit(`send-verification-email:ip:${ip}`, 5, 60)) ??
      (await enforceRateLimit(
        `send-verification-email:email:${email.toLowerCase()}`,
        3,
        300,
      ));
    if (rateLimited) {
      return rateLimited;
    }

    await auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: `${appUrl}/verify-email`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VerificationEmail] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
