"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  callbackUrl: string;
  initialError?: string;
  initialCheckEmail?: boolean;
  initialEmail?: string;
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "AccessDenied":
      return "This email address is not authorized to sign in. Please verify ALLOWED_EMAILS or contact your administrator.";
    case "Verification":
      return "The one-time sign-in link has expired or has already been used. Please request a new code below.";
    case "Configuration":
      return "Email service configuration issue. If self-hosting, check RESEND_API_KEY or EMAIL_SERVER settings.";
    case "EmailSignin":
      return "Unable to deliver sign-in email. Please check your email address and try again.";
    case "OAuthCallback":
    case "OAuthSignin":
      return "Authentication provider error. Please try again.";
    case "Default":
    default:
      return error || "An unexpected error occurred during sign in. Please try again.";
  }
}

export default function LoginForm({
  callbackUrl,
  initialError,
  initialCheckEmail = false,
  initialEmail = "",
}: LoginFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">(initialCheckEmail ? "otp" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(initialError ? getErrorMessage(initialError) : null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSendCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/otp/send-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send sign-in code.");
      }

      setStep("otp");
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send sign-in code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/otp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
          callbackUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid or expired verification code.");
      }

      startTransition(() => {
        router.push(data.redirectUrl || callbackUrl || "/dashboard");
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3.5 text-sm text-red-200 flex items-start gap-2.5 animate-in fade-in duration-150">
          <svg className="w-4 h-4 shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending Sign-In Code...
              </>
            ) : (
              "Email me a magic link & code"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in duration-150">
          <div className="text-center py-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-foreground">Check your inbox</h2>
            <p className="text-xs text-muted mt-1">
              We sent a one-click magic link and 6-digit code to <strong className="text-foreground">{email}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="otp" className="block text-xs font-medium text-center text-muted uppercase tracking-wider">
              Enter 6-digit code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold px-4 py-3 rounded bg-surface border border-border text-foreground placeholder:text-zinc-600 focus:border-accent/60 focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || isPending || otp.length < 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30 disabled:opacity-50"
          >
            {loading || isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying & Signing In...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </button>

          <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
              className="text-zinc-400 hover:text-foreground transition-colors"
            >
              ← Use different email
            </button>

            {countdown > 0 ? (
              <span className="text-zinc-500">Resend in {countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={() => handleSendCode()}
                disabled={loading}
                className="text-accent hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
