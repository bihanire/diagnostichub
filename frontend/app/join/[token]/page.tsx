"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getInviteInfo, requestInviteOtp, verifyInviteOtp } from "@/lib/api";
import type { InviteInfoResponse } from "@/lib/types";

const OTP_EXPIRY_SECONDS = 180;
const ROLE_LABELS: Record<string, string> = {
  ec_agent: "EC Agent",
  ec_manager: "EC Manager",
  watu_ops: "Watu Ops",
};

export default function JoinPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfoResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "verify" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    getInviteInfo(token)
      .then((info) => {
        if (!info.valid) {
          setLoadError("This invite link has expired or reached its maximum uses.");
        } else {
          setInvite(info);
        }
      })
      .catch(() => setLoadError("Invite link not found or already used."));
  }, [token]);

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
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestInviteOtp(token, email.trim());
      setStep("verify");
      setCountdown(OTP_EXPIRY_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifySubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || !fullName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyInviteOtp(token, email.trim(), code.trim(), fullName.trim());
      if (result.action === "dashboard") {
        router.replace("/dashboard");
      } else {
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  if (loadError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="auth-brand-name">Watu Simu</span>
            <span className="auth-brand-sub">Experience Center Portal</span>
          </div>
          <p className="auth-error" role="alert">{loadError}</p>
          <p className="auth-footer">Contact your Watu administrator for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-loading">Loading invite…</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="auth-brand-name">Watu Simu</span>
            <span className="auth-brand-sub">Experience Center Portal</span>
          </div>
          <div className="join-success-icon" aria-hidden="true">✓</div>
          <h1 className="auth-title">Registration submitted</h1>
          <p className="auth-body">
            Your account for <strong>{invite.ec_name}</strong> has been created and is pending
            approval. A Watu administrator will review and activate it shortly.
          </p>
          <p className="auth-footer">
            Once approved, sign in at <a className="auth-link" href="/login">/login</a> using your
            email and a one-time code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true"><span /><span /></span>
          <span className="auth-brand-name">Watu Simu</span>
          <span className="auth-brand-sub">Experience Center Portal</span>
        </div>

        <div className="join-invite-banner">
          <span className="join-invite-ec">{invite.ec_name}</span>
          <span className="join-invite-role">{ROLE_LABELS[invite.role] ?? invite.role}</span>
          {invite.label ? <span className="join-invite-label">{invite.label}</span> : null}
        </div>

        {step === "email" ? (
          <>
            <h1 className="auth-title">Join your team</h1>
            <p className="auth-body">Enter your work email to get a one-time code and create your account.</p>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <form className="auth-form" onSubmit={handleEmailSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="join-email">Email address</label>
                <input
                  autoFocus
                  className="auth-input"
                  id="join-email"
                  inputMode="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="auth-submit-btn" disabled={submitting} type="submit">
                {submitting ? "Sending…" : "Send code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title">Verify & register</h1>
            <p className="auth-body">
              Code sent to <strong>{email}</strong>.
              {countdown > 0 ? <> Expires in <span className="auth-countdown">{mm}:{ss}</span>.</> : " Code expired — go back."}
            </p>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <form className="auth-form" onSubmit={handleVerifySubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="join-code">6-digit code</label>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  className="auth-input auth-input-otp"
                  id="join-code"
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
              <div className="auth-field">
                <label className="auth-label" htmlFor="join-name">Your full name</label>
                <input
                  className="auth-input"
                  id="join-name"
                  placeholder="First and last name"
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <button
                className="auth-submit-btn"
                disabled={submitting || code.length !== 6 || !fullName.trim()}
                type="submit"
              >
                {submitting ? "Registering…" : "Complete registration"}
              </button>
            </form>
            <button className="auth-link-btn" type="button" onClick={() => { setStep("email"); setCode(""); }}>
              ← Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
