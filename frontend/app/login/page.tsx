"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuthStatus, requestOtp, verifyOtp } from "@/lib/api";

const OTP_EXPIRY_SECONDS = 180;

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAuthStatus()
      .then((s) => {
        if (s.authenticated && s.user?.approval_status === "approved") {
          router.replace("/dashboard");
        } else if (s.authenticated && s.user?.approval_status === "pending") {
          router.replace("/pending");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(trimmed);
      setStep("otp");
      setCountdown(OTP_EXPIRY_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyOtp(email.trim(), code.trim());
      if (result.action === "dashboard") {
        router.replace("/dashboard");
      } else if (result.action === "register") {
        router.replace(result.needs_name ? "/register?needs_name=1" : "/register");
      } else {
        router.replace("/pending");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
      setSubmitting(false);
    }
  }

  function handleResend() {
    setCode("");
    setError(null);
    setStep("email");
    setCountdown(0);
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-loading">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            <span /><span />
          </span>
          <span className="auth-brand-name">Watu Simu</span>
          <span className="auth-brand-sub">Experience Center Portal</span>
        </div>

        {step === "email" ? (
          <>
            <h1 className="auth-title">Sign in</h1>
            <p className="auth-body">Enter your work email to receive a one-time login code.</p>

            {error ? <p className="auth-error" role="alert">{error}</p> : null}

            <form className="auth-form" onSubmit={handleEmailSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="email">Email address</label>
                <input
                  autoFocus
                  className="auth-input"
                  id="email"
                  inputMode="email"
                  placeholder="you@watu.africa"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="auth-submit-btn" disabled={submitting} type="submit">
                {submitting ? "Sending…" : "Send login code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title">Enter your code</h1>
            <p className="auth-body">
              We sent a 6-digit code to <strong>{email}</strong>.
              {countdown > 0 ? <> Expires in <span className="auth-countdown">{mm}:{ss}</span>.</> : " The code has expired."}
            </p>

            {error ? <p className="auth-error" role="alert">{error}</p> : null}

            <form className="auth-form" onSubmit={handleOtpSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="otp-code">6-digit code</label>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  className="auth-input auth-input-otp"
                  id="otp-code"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  required
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <button
                className="auth-submit-btn"
                disabled={submitting || code.length !== 6}
                type="submit"
              >
                {submitting ? "Verifying…" : "Verify code"}
              </button>
            </form>

            <button className="auth-link auth-link-btn" type="button" onClick={handleResend}>
              Use a different email or resend code
            </button>
          </>
        )}

        <p className="auth-footer">
          Access is by invitation. Contact your Watu administrator if you can&apos;t sign in.
        </p>
      </div>
    </div>
  );
}
