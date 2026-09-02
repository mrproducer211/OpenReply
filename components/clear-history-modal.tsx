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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("initial");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOtp("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 text-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            âœ•
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-950/80 border border-red-500/50 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {step === "initial" ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/60 p-3.5 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
              <svg className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                <strong>Warning:</strong> This action cannot be undone. To prevent accidental data loss, a 6-digit security code will be sent to the email address associated with your account.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
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
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Enter the 6-digit security code sent to <strong className="text-white">{maskedEmail}</strong>:
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Expires in 10 minutes</span>
              {countdown > 0 ? (
                <span className="text-zinc-500">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="font-medium text-red-400 hover:underline disabled:opacity-50"
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
                className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
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
