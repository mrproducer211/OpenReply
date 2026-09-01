"use client";

import { useState, useEffect } from "react";

interface ClearHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description: string;
  purpose: "clear-dm-logs" | "clear-diagnostics";
  purposeLabel: string;
  clearEndpoint: string;
}

export default function ClearHistoryModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  purpose,
  purposeLabel,
  clearEndpoint,
}: ClearHistoryModalProps) {
  const [step, setStep] = useState<"initial" | "otp">("initial");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setStep("initial");
      setOtp("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  async function handleSendOtp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, purposeLabel }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to send verification code");
      }
      setMaskedEmail(data.maskedEmail || "your email");
      setStep("otp");
      setCountdown(60); // 60s cooldown for resend
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmClear() {
    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(clearEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Verification failed");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear history");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-muted/10 hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {step === "initial" ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              ⚠️ <strong>Warning:</strong> This action cannot be undone. To prevent accidental data loss, a 6-digit security code will be sent to your account email.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? "Sending Code..." : "Send OTP & Proceed"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Enter the 6-digit security code sent to <strong className="text-foreground">{maskedEmail}</strong>:
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted/30 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span>Expires in 10 minutes</span>
              {countdown > 0 ? (
                <span>Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Resend Code
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={loading || otp.length < 6}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? "Verifying & Clearing..." : "Confirm & Clear History"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
