"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approveUser, createAdminUser, getAuthStatus, getECLocations, listAdminUsers, suspendUser } from "@/lib/api";
import { AdminUserItem, AdminUserListResponse, ECLocationItem } from "@/lib/types";

type StatusFilter = "all" | "pending" | "approved" | "suspended";

const ROLES = [
  { value: "ec_agent", label: "EC Agent" },
  { value: "ec_manager", label: "EC Manager" },
  { value: "watu_ops", label: "Watu Ops" },
  { value: "watu_admin", label: "Watu Admin" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  suspended: "Suspended",
};

const ROLE_LABELS: Record<string, string> = {
  ec_agent: "EC Agent",
  ec_manager: "EC Manager",
  watu_ops: "Watu Ops",
  watu_admin: "Watu Admin",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [locations, setLocations] = useState<ECLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("approved");
  const [actioning, setActioning] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create user form state
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState("ec_agent");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createCountry, setCreateCountry] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) {
          router.replace("/login");
          return;
        }
        if (auth.user?.role !== "watu_admin") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }
      const [, locs] = await Promise.all([reload(), getECLocations()]);
      setLocations(locs.locations);
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function reload() {
    setLoading(true);
    try {
      const result = await listAdminUsers();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const locId = parseInt(createLocationId, 10);
    if (!createEmail || !createName || !createCountry || !locId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createAdminUser({
        email: createEmail.trim(),
        full_name: createName.trim(),
        role: createRole,
        ec_location_id: locId,
        country_code: createCountry,
      });
      showToast(res.message);
      setData((prev) =>
        prev
          ? { ...prev, users: [res.user, ...prev.users], total: prev.total + 1 }
          : prev
      );
      setCreateEmail("");
      setCreateName("");
      setCreateRole("ec_agent");
      setCreateLocationId("");
      setCreateCountry("");
      setShowCreate(false);
      setFilter("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(user: AdminUserItem) {
    setActioning(user.id);
    try {
      const result = await approveUser(user.id);
      showToast(result.message);
      setData((prev) =>
        prev
          ? {
              ...prev,
              pending_count: prev.pending_count - (user.approval_status === "pending" ? 1 : 0),
              users: prev.users.map((u) => (u.id === user.id ? result.user : u)),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActioning(null);
    }
  }

  async function handleSuspend(user: AdminUserItem) {
    setActioning(user.id);
    try {
      const result = await suspendUser(user.id);
      showToast(result.message);
      setData((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === user.id ? result.user : u)),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActioning(null);
    }
  }

  const visible = (data?.users ?? []).filter(
    (u) => filter === "all" || u.approval_status === filter
  );

  const filters: StatusFilter[] = ["pending", "approved", "suspended", "all"];

  return (
    <div className="admin-page">
      <div className="admin-subnav">
        <a href="/dashboard" className="admin-subnav-back">← Dashboard</a>
        <div className="admin-subnav-links">
          <a href="/admin/users" className="admin-subnav-link admin-subnav-active">Users</a>
          <a href="/admin/invites" className="admin-subnav-link">Invites</a>
          <a href="/admin/allowed-emails" className="admin-subnav-link">Allowlist</a>
          <a href="/admin/activity" className="admin-subnav-link">Activity</a>
        </div>
        {data && data.pending_count > 0 && (
          <span className="admin-pending-badge">{data.pending_count} pending</span>
        )}
      </div>

      <div className="admin-shell">
        <div className="admin-header">
          <div className="admin-header-title">
            <span className="admin-brand-mark" aria-hidden="true" />
            <div>
              <h1 className="admin-title">User Management</h1>
              <p className="admin-subtitle">Create and manage EC agent accounts</p>
            </div>
          </div>
          <button
            className="admin-action-btn admin-action-approve"
            type="button"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "+ Add user"}
          </button>
        </div>

        {showCreate && (
          <div className="admin-card">
            <h2 className="admin-section-title">Create user</h2>
            <form className="invite-form" onSubmit={handleCreate}>
              <div className="invite-form-row">
                <input
                  className="admin-input"
                  inputMode="email"
                  placeholder="Email address"
                  required
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
                <input
                  className="admin-input"
                  placeholder="Full name"
                  required
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="invite-form-row">
                <select
                  className="admin-input"
                  required
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <select
                  className="admin-input"
                  required
                  value={createLocationId}
                  onChange={(e) => {
                    setCreateLocationId(e.target.value);
                    const loc = locations.find((l) => l.id === parseInt(e.target.value, 10));
                    if (loc) setCreateCountry(loc.country_code);
                  }}
                >
                  <option value="">Select EC location…</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.country_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="invite-form-footer">
                <button
                  className="admin-action-btn admin-action-approve"
                  disabled={creating}
                  type="submit"
                >
                  {creating ? "Creating…" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}
        {toast && <p className="admin-toast" role="status">{toast}</p>}

        {/* Filter tabs */}
        <div className="admin-filter-row">
          {filters.map((f) => (
            <button
              key={f}
              className={`admin-filter-btn ${filter === f ? "admin-filter-active" : ""}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
              {f === "pending" && data?.pending_count ? (
                <span className="admin-filter-count">{data.pending_count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* User list */}
        {loading ? (
          <p className="auth-loading">Loading users…</p>
        ) : visible.length === 0 ? (
          <div className="admin-empty">
            <p>No {filter === "all" ? "" : filter} users.</p>
          </div>
        ) : (
          <div className="admin-user-list">
            {visible.map((user) => (
              <div key={user.id} className="admin-user-card">
                <div className="admin-user-info">
                  <div className="admin-user-name-row">
                    <span className="admin-user-name">{user.full_name}</span>
                    <span className={`admin-status-badge admin-status-${user.approval_status}`}>
                      {STATUS_LABELS[user.approval_status]}
                    </span>
                    <span className="admin-role-chip">{ROLE_LABELS[user.role] ?? user.role}</span>
                  </div>
                  <span className="admin-user-email">{user.email}</span>
                  <div className="admin-user-meta">
                    {user.ec_location_name && (
                      <span className="admin-meta-item">
                        <span className="admin-meta-label">EC</span>
                        {user.ec_location_name}
                      </span>
                    )}
                    {user.country_code && (
                      <span className="admin-meta-item">
                        <span className="admin-meta-label">Country</span>
                        {user.country_code}
                      </span>
                    )}
                    <span className="admin-meta-item">
                      <span className="admin-meta-label">Registered</span>
                      {formatDate(user.created_at)}
                    </span>
                    {user.last_login_at && (
                      <span className="admin-meta-item">
                        <span className="admin-meta-label">Last login</span>
                        {formatDate(user.last_login_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="admin-user-actions">
                  {user.approval_status !== "approved" && (
                    <button
                      className="admin-approve-btn"
                      onClick={() => handleApprove(user)}
                      disabled={actioning === user.id}
                      type="button"
                    >
                      {actioning === user.id ? "…" : "Approve"}
                    </button>
                  )}
                  {user.approval_status !== "suspended" && (
                    <button
                      className="admin-suspend-btn"
                      onClick={() => handleSuspend(user)}
                      disabled={actioning === user.id}
                      type="button"
                    >
                      {actioning === user.id ? "…" : "Suspend"}
                    </button>
                  )}
                  {user.approval_status === "suspended" && (
                    <button
                      className="admin-approve-btn"
                      onClick={() => handleApprove(user)}
                      disabled={actioning === user.id}
                      type="button"
                    >
                      {actioning === user.id ? "…" : "Reinstate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && (
          <p className="admin-footer-count">
            {data.total} total user{data.total !== 1 ? "s" : ""} · {data.pending_count} pending approval
          </p>
        )}
      </div>
    </div>
  );
}
