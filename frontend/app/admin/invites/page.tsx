"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createInvite,
  getAuthStatus,
  getECLocations,
  listInvites,
  revokeInvite,
} from "@/lib/api";
import type { ECLocationItem, InviteItem } from "@/lib/types";

const COUNTRY_OPTIONS = [
  { code: "UGA", label: "Uganda" },
  { code: "KEN", label: "Kenya" },
  { code: "TZA", label: "Tanzania" },
  { code: "RWA", label: "Rwanda" },
  { code: "ETH", label: "Ethiopia" },
  { code: "MOZ", label: "Mozambique" },
  { code: "MDG", label: "Madagascar" },
  { code: "ZMB", label: "Zambia" },
];

const ROLE_OPTIONS = [
  { value: "ec_agent", label: "EC Agent" },
  { value: "ec_manager", label: "EC Manager" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-UG", { dateStyle: "short", timeStyle: "short" });
}

function getInviteUrl(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/join/${token}`;
}

export default function InvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [locations, setLocations] = useState<ECLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // Form
  const [country, setCountry] = useState("UGA");
  const [locationId, setLocationId] = useState("");
  const [role, setRole] = useState("ec_agent");
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("14");
  const [maxUses, setMaxUses] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) { router.replace("/login"); return; }
        if (auth.user?.role !== "watu_admin") { router.replace("/dashboard"); return; }
      } catch { router.replace("/login"); return; }

      try {
        const [inv, locs] = await Promise.all([listInvites(), getECLocations()]);
        setInvites(inv.invites);
        setLocations(locs.locations);
      } catch {
        setError("Could not load invites.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!locationId) { setError("Select an EC location."); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await createInvite({
        ec_location_id: parseInt(locationId, 10),
        country_code: country,
        role,
        label: label.trim() || undefined,
        expires_in_days: parseInt(expiryDays, 10) || 14,
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
        auto_approve: autoApprove,
      });
      setInvites((prev) => [res.invite, ...prev]);
      setLabel("");
      setMaxUses("");
      showToast("Invite link created — copy it from the table below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    setRevoking(id);
    try {
      await revokeInvite(id);
      setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: false } : i)));
      showToast("Invite revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke.");
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(invite: InviteItem) {
    const url = getInviteUrl(invite.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(invite.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast(url);
    }
  }

  const filteredLocations = locations.filter((l) => l.country_code === country);
  const activeInvites = invites.filter((i) => i.is_active);
  const expiredInvites = invites.filter((i) => !i.is_active);

  return (
    <div className="admin-page">
      <div className="admin-subnav">
        <a href="/dashboard" className="admin-subnav-back">← Dashboard</a>
        <div className="admin-subnav-links">
          <a href="/admin/users" className="admin-subnav-link">Users</a>
          <a href="/admin/invites" className="admin-subnav-link admin-subnav-active">Invites</a>
          <a href="/admin/allowed-emails" className="admin-subnav-link">Allowlist</a>
          <a href="/admin/activity" className="admin-subnav-link">Activity</a>
        </div>
      </div>

      <div className="admin-page-header">
        <h1 className="admin-title">Invite Links</h1>
        <p className="admin-subtitle">
          Generate shareable links for EC managers to register their teams. No pre-adding emails required.
        </p>
      </div>

      {toast ? <p className="admin-toast" role="status">{toast}</p> : null}
      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      <div className="admin-card">
        <h2 className="admin-section-title">Create invite link</h2>
        <form className="invite-form" onSubmit={handleCreate}>
          <div className="invite-form-row">
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="inv-country">Country</label>
              <select className="admin-input" id="inv-country" value={country}
                onChange={(e) => { setCountry(e.target.value); setLocationId(""); }}>
                {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="auth-field" style={{ flex: 2 }}>
              <label className="auth-label" htmlFor="inv-location">EC Location</label>
              <select className="admin-input" id="inv-location" value={locationId} required
                onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Select EC location</option>
                {filteredLocations.map((l) => (
                  <option key={l.id} value={l.id.toString()}>{l.name}{l.region ? ` — ${l.region}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="inv-role">Role</label>
              <select className="admin-input" id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="invite-form-row">
            <div className="auth-field" style={{ flex: 3 }}>
              <label className="auth-label" htmlFor="inv-label">Label <span className="admin-muted">(optional — shown to agents joining)</span></label>
              <input className="admin-input" id="inv-label" placeholder="e.g. Kampala branch — March intake"
                type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="inv-expiry">Expires in (days)</label>
              <input className="admin-input" id="inv-expiry" min="1" max="90" type="number"
                value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="inv-maxuses">Max uses <span className="admin-muted">(blank = unlimited)</span></label>
              <input className="admin-input" id="inv-maxuses" min="1" placeholder="∞" type="number"
                value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
          </div>
          <div className="invite-form-footer">
            <label className="invite-checkbox-label">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
              Auto-approve registrants (skip admin review)
            </label>
            <button className="admin-action-btn admin-action-approve" disabled={creating || !locationId} type="submit">
              {creating ? "Creating…" : "Generate link"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="admin-section-title">
          Active links
          <span className="admin-badge-count">{activeInvites.length}</span>
        </h2>
        {loading ? <p className="admin-loading">Loading…</p> :
         activeInvites.length === 0 ? <p className="admin-empty">No active invite links. Create one above.</p> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label / EC</th>
                <th>Role</th>
                <th>Uses</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeInvites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className="admin-cell-primary">{inv.label ?? <span className="admin-muted">No label</span>}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #6b7280)" }}>
                      {inv.country_code}
                      {inv.auto_approve ? <span className="invite-auto-badge">auto-approve</span> : null}
                    </div>
                  </td>
                  <td>{inv.role === "ec_agent" ? "EC Agent" : "EC Manager"}</td>
                  <td>{inv.use_count}{inv.max_uses ? ` / ${inv.max_uses}` : ""}</td>
                  <td>{formatDate(inv.expires_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="admin-action-btn admin-action-copy" type="button"
                        onClick={() => handleCopy(inv)}>
                        {copied === inv.id ? "Copied!" : "Copy link"}
                      </button>
                      <button className="admin-action-btn admin-action-suspend" type="button"
                        disabled={revoking === inv.id}
                        onClick={() => handleRevoke(inv.id)}>
                        {revoking === inv.id ? "…" : "Revoke"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {expiredInvites.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-section-title admin-muted">
            Expired / revoked
            <span className="admin-badge-count">{expiredInvites.length}</span>
          </h2>
          <table className="admin-table">
            <thead>
              <tr><th>Label</th><th>Role</th><th>Uses</th><th>Created</th></tr>
            </thead>
            <tbody>
              {expiredInvites.map((inv) => (
                <tr key={inv.id} style={{ opacity: 0.55 }}>
                  <td>{inv.label ?? <span className="admin-muted">—</span>}</td>
                  <td>{inv.role === "ec_agent" ? "EC Agent" : "EC Manager"}</td>
                  <td>{inv.use_count}{inv.max_uses ? ` / ${inv.max_uses}` : ""}</td>
                  <td>{formatDateTime(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
