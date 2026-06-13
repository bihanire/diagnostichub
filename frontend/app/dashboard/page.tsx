"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuthStatus, logoutUser } from "@/lib/api";
import type { AppUser } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.authenticated) {
          router.replace("/login");
          return;
        }
        if (status.user?.approval_status === "pending") {
          router.replace("/pending");
          return;
        }
        if (status.user?.approval_status === "suspended") {
          router.replace("/login?error=suspended");
          return;
        }
        setUser(status.user ?? null);
        setLoading(false);
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

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-loading">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <div className="dashboard-header-brand">
          <span className="auth-brand-mark dashboard-brand-mark" aria-hidden="true">
            <span /><span />
          </span>
          <span className="dashboard-header-title">Watu Simu EC Portal</span>
        </div>
        <div className="dashboard-header-user">
          <span className="dashboard-user-name">{user?.full_name}</span>
          {user?.ec_location ? (
            <span className="dashboard-user-location">{user.ec_location.name}</span>
          ) : null}
          <button
            className="dashboard-logout-btn"
            disabled={loggingOut}
            onClick={handleLogout}
            type="button"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-welcome">
          <h1 className="dashboard-welcome-title">
            Good to see you, {user?.full_name?.split(" ")[0]}.
          </h1>
          <p className="dashboard-welcome-body">
            {user?.ec_location
              ? `You are registered at ${user.ec_location.name}, ${user.ec_location.city}.`
              : "Your Experience Center is not yet linked. Contact your Watu administrator."}
          </p>
        </section>

        <div className="dashboard-actions">
          <button
            className="dashboard-action-card dashboard-action-primary"
            onClick={() => router.push("/")}
            type="button"
          >
            <span className="dashboard-action-icon" aria-hidden="true">+</span>
            <strong>New diagnostic</strong>
            <span>Search symptoms and run a full triage</span>
          </button>

          <button
            className="dashboard-action-card dashboard-action-secondary"
            onClick={() => router.push("/cases")}
            type="button"
          >
            <span className="dashboard-action-icon" aria-hidden="true">&#9776;</span>
            <strong>My cases</strong>
            <span>View and manage job cards from your EC</span>
          </button>

          <button
            className="dashboard-action-card dashboard-action-secondary"
            onClick={() => router.push("/playbook")}
            type="button"
          >
            <span className="dashboard-action-icon" aria-hidden="true">&#9654;</span>
            <strong>EC playbook</strong>
            <span>Warranty, FRP, returns, theft, PAYG unlocking</span>
          </button>

          {user?.role === "watu_admin" && (
            <button
              className="dashboard-action-card dashboard-action-admin"
              onClick={() => router.push("/admin/users")}
              type="button"
            >
              <span className="dashboard-action-icon" aria-hidden="true">&#9646;&#9646;</span>
              <strong>User approvals</strong>
              <span>Review and approve EC agent registrations</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
