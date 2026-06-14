"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getActivity, getAuthStatus } from "@/lib/api";
import type { ActivityResponse, AppUser } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  ec_agent: "Agent",
  ec_manager: "Manager",
};

const COUNTRY_FLAGS: Record<string, string> = {
  UGA: "🇺🇬", KEN: "🇰🇪", TZA: "🇹🇿", RWA: "🇷🇼", ETH: "🇪🇹",
  MOZ: "🇲🇿", MDG: "🇲🇬", ZMB: "🇿🇲",
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

const OPS_ROLES = new Set(["watu_admin", "watu_ops"]);

export default function ActivityPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) { router.replace("/login"); return; }
        if (!auth.user || !OPS_ROLES.has(auth.user.role)) { router.replace("/dashboard"); return; }
        setUser(auth.user);
      } catch { router.replace("/login"); return; }

      try {
        setData(await getActivity());
      } catch {
        setError("Could not load activity data.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  return (
    <div className="admin-page">
      <div className="admin-subnav">
        <a href="/dashboard" className="admin-subnav-back">← Dashboard</a>
        <div className="admin-subnav-links">
          {user?.role === "watu_admin" && (
            <>
              <a href="/admin/users" className="admin-subnav-link">Users</a>
              <a href="/admin/invites" className="admin-subnav-link">Invites</a>
            </>
          )}
          <a href="/admin/activity" className="admin-subnav-link admin-subnav-active">Activity</a>
        </div>
      </div>

      <div className="admin-page-header">
        <div>
          <h1 className="admin-title">Activity Dashboard</h1>
          {data ? (
            <p className="admin-subtitle">
              Last 30 days · Generated {new Date(data.generated_at).toLocaleTimeString("en-UG", { timeStyle: "short" })}
            </p>
          ) : (
            <p className="admin-subtitle">Last 30 days</p>
          )}
        </div>
      </div>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      {loading ? (
        <p className="admin-loading" style={{ textAlign: "center", padding: "3rem 0" }}>Loading activity data…</p>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="activity-summary">
            <div className="activity-stat-card">
              <span className="activity-stat-value">{data.summary.total_active_agents}</span>
              <span className="activity-stat-label">Active agents</span>
            </div>
            <div className="activity-stat-card activity-stat-cases">
              <span className="activity-stat-value">{data.summary.total_cases_30d}</span>
              <span className="activity-stat-label">Cases (30d)</span>
            </div>
            <div className="activity-stat-card activity-stat-ecs">
              <span className="activity-stat-value">{data.summary.active_ecs}</span>
              <span className="activity-stat-label">Active ECs</span>
            </div>
            <div className="activity-stat-card activity-stat-pending">
              <span className="activity-stat-value">{data.summary.pending_approvals}</span>
              <span className="activity-stat-label">Pending approvals</span>
              {data.summary.pending_approvals > 0 ? (
                <a className="activity-stat-action" href="/admin/users">Review →</a>
              ) : null}
            </div>
          </div>

          {/* By EC */}
          <div className="admin-card">
            <h2 className="admin-section-title">By Experience Center</h2>
            {data.by_ec.length === 0 ? (
              <p className="admin-empty">No EC data yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Experience Center</th>
                    <th style={{ textAlign: "center" }}>Agents</th>
                    <th style={{ textAlign: "center" }}>Cases (30d)</th>
                    <th>Last case</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_ec.map((ec) => (
                    <tr key={ec.ec_id}>
                      <td>
                        <span className="admin-cell-primary">
                          {COUNTRY_FLAGS[ec.country_code] ?? ""} {ec.ec_name}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {ec.agent_count > 0 ? ec.agent_count : <span className="admin-muted">—</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {ec.cases_30d > 0 ? (
                          <span className="activity-case-count">{ec.cases_30d}</span>
                        ) : (
                          <span className="admin-muted">0</span>
                        )}
                      </td>
                      <td>{timeAgo(ec.last_case_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top agents */}
          <div className="admin-card">
            <h2 className="admin-section-title">
              Agents by volume
              <span className="admin-badge-count">{data.top_agents.length}</span>
            </h2>
            {data.top_agents.length === 0 ? (
              <p className="admin-empty">No agent data yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>EC</th>
                    <th style={{ textAlign: "center" }}>Cases (30d)</th>
                    <th>Last login</th>
                    <th>Last case</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_agents.map((agent) => (
                    <tr key={agent.user_id}>
                      <td>
                        <div className="admin-cell-primary">{agent.full_name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary, #6b7280)" }}>
                          {agent.email} · <span className="admin-role-chip">{ROLE_LABELS[agent.role] ?? agent.role}</span>
                        </div>
                      </td>
                      <td>{agent.ec_name ?? <span className="admin-muted">—</span>}</td>
                      <td style={{ textAlign: "center" }}>
                        {agent.cases_30d > 0 ? (
                          <span className="activity-case-count">{agent.cases_30d}</span>
                        ) : (
                          <span className="admin-muted activity-inactive">0</span>
                        )}
                      </td>
                      <td>{timeAgo(agent.last_login_at)}</td>
                      <td>{timeAgo(agent.last_case_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
