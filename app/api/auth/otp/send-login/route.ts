import { NextRequest, NextResponse } from "next/server";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { generateAndSendOtp } from "@/lib/email/otp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (!isEmailAllowedToSignIn(email)) {
      return NextResponse.json(
        { success: false, error: "This email address is not authorized to sign in." },
        { status: 403 }
      );
    }

    const result = await generateAndSendOtp(email, "login", "sign in to your OpenReply account");

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send sign-in code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process request";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
