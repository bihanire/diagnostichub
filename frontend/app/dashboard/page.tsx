"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCaseStats, getAuthStatus, logoutUser } from "@/lib/api";
import type { AppUser, CaseStatsResponse } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [stats, setStats] = useState<CaseStatsResponse | null>(null);
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
        getCaseStats().then(setStats).catch(() => null);
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
              : user?.role === "watu_ops" || user?.role === "watu_admin"
              ? "You have access to all Experience Centers."
              : "Your Experience Center is not yet linked. Contact your Watu administrator."}
          </p>
        </section>

        {stats && (
          <div className="dashboard-stats">
            <button
              className="dashboard-stat-card dashboard-stat-open"
              onClick={() => router.push("/cases?status=open")}
              type="button"
            >
              <span className="dashboard-stat-count">{stats.open}</span>
              <span className="dashboard-stat-label">Open</span>
            </button>
            <button
              className="dashboard-stat-card dashboard-stat-dispatched"
              onClick={() => router.push("/cases?status=dispatched")}
              type="button"
            >
              <span className="dashboard-stat-count">{stats.dispatched}</span>
              <span className="dashboard-stat-label">Dispatched</span>
            </button>
            <button
              className="dashboard-stat-card dashboard-stat-closed"
              onClick={() => router.push("/cases?status=closed")}
              type="button"
            >
              <span className="dashboard-stat-count">{stats.closed}</span>
              <span className="dashboard-stat-label">Closed</span>
            </button>
            <button
              className="dashboard-stat-card dashboard-stat-total"
              onClick={() => router.push("/cases")}
              type="button"
            >
              <span className="dashboard-stat-count">{stats.total}</span>
              <span className="dashboard-stat-label">Total</span>
            </button>
          </div>
        )}

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
            <strong>{user?.role === "watu_ops" || user?.role === "watu_admin" ? "All cases" : "My cases"}</strong>
            <span>{user?.role === "watu_ops" || user?.role === "watu_admin" ? "View and search job cards across all ECs" : "View and manage job cards from your EC"}</span>
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

          <button
            className="dashboard-action-card dashboard-action-secondary"
            onClick={() => router.push("/sop")}
            type="button"
          >
            <span className="dashboard-action-icon" aria-hidden="true">&#9776;</span>
            <strong>SOP</strong>
            <span>Repairs, returns, theft, recovery, dispatch — step by step</span>
          </button>

          <button
            className="dashboard-action-card dashboard-action-secondary"
            onClick={() => router.push("/profile")}
            type="button"
          >
            <span className="dashboard-action-icon" aria-hidden="true">&#9673;</span>
            <strong>My account</strong>
            <span>Your role, EC location, and sign out</span>
          </button>

          {(user?.role === "watu_admin" || user?.role === "watu_ops") && (
            <button
              className="dashboard-action-card dashboard-action-admin"
              onClick={() => router.push("/admin/activity")}
              type="button"
            >
              <span className="dashboard-action-icon" aria-hidden="true">&#9641;</span>
              <strong>Activity dashboard</strong>
              <span>EC volumes, agent activity, and case trends (last 30d)</span>
            </button>
          )}

          {user?.role === "watu_admin" && (
            <button
              className="dashboard-action-card dashboard-action-admin"
              onClick={() => router.push("/admin/users")}
              type="button"
            >
              <span className="dashboard-action-icon" aria-hidden="true">&#9646;&#9646;</span>
              <strong>User management</strong>
              <span>Create, approve, and manage EC agent accounts</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
