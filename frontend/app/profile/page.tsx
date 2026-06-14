"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus, logoutUser } from "@/lib/api";
import type { AppUser } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  ec_agent: "EC Agent",
  ec_manager: "EC Manager",
  watu_ops: "Watu Ops",
  watu_admin: "Watu Administrator",
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((s) => {
        if (!s.authenticated || !s.user) {
          router.replace("/login");
          return;
        }
        setUser(s.user);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <div className="case-page">
        <div className="case-card">
          <p className="auth-loading">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="case-page">
      <div className="case-card">
        <div className="case-header">
          <button className="case-back-btn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true" />
            <span className="auth-brand-name">DiagnosticHub</span>
            <span className="auth-brand-sub">My Account</span>
          </div>
        </div>

        <div className="profile-avatar" aria-hidden="true">
          {user.full_name.charAt(0).toUpperCase()}
        </div>

        <h1 className="profile-name">{user.full_name}</h1>
        <p className="profile-email">{user.email}</p>

        <div className="profile-grid">
          <div className="profile-field">
            <span className="profile-label">Role</span>
            <span className="profile-value">{ROLE_LABELS[user.role] ?? user.role}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Status</span>
            <span className={`profile-value status-badge ${user.approval_status === "approved" ? "status-positive" : ""}`}>
              {user.approval_status.charAt(0).toUpperCase() + user.approval_status.slice(1)}
            </span>
          </div>
          {user.ec_location && (
            <>
              <div className="profile-field">
                <span className="profile-label">Experience Center</span>
                <span className="profile-value">{user.ec_location.name}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">City</span>
                <span className="profile-value">{user.ec_location.city}</span>
              </div>
              {user.ec_location.region && (
                <div className="profile-field">
                  <span className="profile-label">Region</span>
                  <span className="profile-value">{user.ec_location.region}</span>
                </div>
              )}
              <div className="profile-field">
                <span className="profile-label">Country</span>
                <span className="profile-value">{user.ec_location.country_code}</span>
              </div>
            </>
          )}
        </div>

        <p className="profile-hint">
          To update your details or change your EC location, contact your Watu administrator.
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
