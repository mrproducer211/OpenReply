import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { verifyOtp } from "@/lib/email/otp";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    const callbackUrl = typeof body.callbackUrl === "string" && body.callbackUrl.startsWith("/")
      ? body.callbackUrl
      : "/dashboard";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (!otp) {
      return NextResponse.json(
        { success: false, error: "Please enter the 6-digit verification code" },
        { status: 400 }
      );
    }

    if (!isEmailAllowedToSignIn(email)) {
      return NextResponse.json(
        { success: false, error: "This email address is not authorized to sign in." },
        { status: 403 }
      );
    }

    const otpResult = await verifyOtp(email, "login", otp);
    if (!otpResult.valid) {
      return NextResponse.json(
        { success: false, error: otpResult.error || "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
        },
      });
      await ensureWorkspaceForUser(user.id, email);
    } else {
      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
      await ensureWorkspaceForUser(user.id, email);
    }

    // Create database session for NextAuth
    const sessionToken = randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    // Set NextAuth session cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProduction,
      expires,
    };

    cookieStore.set("authjs.session-token", sessionToken, cookieOptions);
    cookieStore.set("next-auth.session-token", sessionToken, cookieOptions);
    if (isProduction) {
      cookieStore.set("__Secure-authjs.session-token", sessionToken, cookieOptions);
      cookieStore.set("__Secure-next-auth.session-token", sessionToken, cookieOptions);
    }

    return NextResponse.json({
      success: true,
      redirectUrl: callbackUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
