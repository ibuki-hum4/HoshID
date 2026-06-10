import { type NextRequest, NextResponse } from "next/server";

import auditLog from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: request.headers });
    const sessionUser = session?.user;
    if (!sessionUser?.id || !sessionUser.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCount = await prisma.user.count({ where: { role: "admin" } });

    if (adminCount > 0) {
      // Admins already exist: only an existing admin may promote further users.
      const requester = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { role: true },
      });

      if (requester?.role !== "admin") {
        auditLog("admin.make-admin.forbidden", {
          requesterId: sessionUser.id,
          target: email,
        });
        return NextResponse.json(
          { error: "admin role required" },
          { status: 403 },
        );
      }
    } else if (sessionUser.email.toLowerCase() !== email.toLowerCase()) {
      // Bootstrap: before any admin exists, the signed-in user may only
      // promote their own freshly-created account.
      auditLog("admin.make-admin.forbidden", {
        requesterId: sessionUser.id,
        target: email,
      });
      return NextResponse.json(
        { error: "can only bootstrap your own account" },
        { status: 403 },
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "admin" },
      select: { id: true, email: true, role: true },
    });

    auditLog("admin.make-admin.success", {
      requesterId: sessionUser.id,
      targetId: user.id,
      targetEmail: user.email,
    });

    return NextResponse.json({
      success: true,
      message: `${email} is now admin`,
      user,
    });
  } catch (error) {
    console.error("[MakeAdmin] Error:", error);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 },
    );
  }
}
