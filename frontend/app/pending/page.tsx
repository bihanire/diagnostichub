"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuthStatus, logoutUser } from "@/lib/api";
import type { AppUser } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [approved, setApproved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check(redirect = true): Promise<boolean> {
    try {
      const s = await getAuthStatus();
      if (!s.authenticated) {
        if (redirect) router.replace("/login");
        return false;
      }
      if (s.user?.approval_status === "approved") {
        setApproved(true);
        if (redirect) setTimeout(() => router.replace("/dashboard"), 1800);
        return true;
      }
      if (s.user?.approval_status === "suspended") {
        if (redirect) router.replace("/login?error=suspended");
        return false;
      }
      setUser(s.user ?? null);
      return false;
    } catch {
      if (redirect) router.replace("/login");
      return false;
    }
  }

  useEffect(() => {
    void check();
    intervalRef.current = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  }

  if (approved) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="auth-brand-name">Watu Simu</span>
          </div>
          <div className="auth-pending-icon" aria-hidden="true"><span /></div>
          <h1 className="auth-title" style={{ color: "#057a55" }}>Account approved!</h1>
          <p className="auth-body">Taking you to the dashboard…</p>
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

        <div className="auth-pending-icon" aria-hidden="true">
          <span />
        </div>

        <h1 className="auth-title">Account pending approval</h1>
        <p className="auth-body">
          {user?.full_name ? `Hi ${user.full_name} — your` : "Your"} registration has been received.
          A Watu administrator will review and approve your account shortly.
        </p>

        {user?.ec_location ? (
          <div className="auth-pending-detail">
            <span className="auth-pending-label">Registered at</span>
            <strong>{user.ec_location.name}</strong>
            <span className="auth-pending-label">{user.ec_location.city}</span>
          </div>
        ) : null}

        <p className="auth-body" style={{ marginTop: "1rem" }}>
          You will receive an email when your account is ready — no need to re-register or
          stay on this page. This page checks automatically every 30 seconds.
        </p>

        <button
          className="auth-secondary-btn"
          disabled={loggingOut}
          onClick={handleLogout}
          type="button"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
