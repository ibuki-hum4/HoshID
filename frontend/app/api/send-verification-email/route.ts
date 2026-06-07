import { NextRequest, NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?email=${encodeURIComponent(email)}`;
    
    console.log("[VerificationEmail] Sending to", email);
    await sendVerificationEmail(email, verifyUrl);
    console.log("[VerificationEmail] ✓ Sent");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VerificationEmail] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
