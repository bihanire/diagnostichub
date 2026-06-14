"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuthStatus, logoutUser } from "@/lib/api";
import type { AppUser } from "@/lib/types";

export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.authenticated) {
          router.replace("/login");
          return;
        }
        if (status.user?.approval_status === "approved") {
          router.replace("/dashboard");
          return;
        }
        if (status.user?.approval_status === "suspended") {
          router.replace("/login?error=suspended");
          return;
        }
        setUser(status.user ?? null);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
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
          Your registration has been received.{user?.full_name ? ` Hi ${user.full_name},` : ""}{" "}
          A Watu administrator will review and approve your account shortly.
        </p>

        {user?.ec_location ? (
          <div className="auth-pending-detail">
            <span className="auth-pending-label">Registered as</span>
            <strong>{user.ec_location.name}</strong>
            <span className="auth-pending-label">{user.ec_location.city}</span>
          </div>
        ) : null}

        <p className="auth-body" style={{ marginTop: "1rem" }}>
          Once approved you will be able to sign in and access the full platform.
          You do not need to re-register — just come back and sign in with your work email address.
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
