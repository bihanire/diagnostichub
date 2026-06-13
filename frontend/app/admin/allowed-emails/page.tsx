"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addAllowedEmail,
  getAuthStatus,
  listAllowedEmails,
  removeAllowedEmail,
} from "@/lib/api";
import type { AllowedEmailItem } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-UG", { dateStyle: "medium" });
}

export default function AllowedEmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<AllowedEmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const auth = await getAuthStatus();
        if (!auth.authenticated) { router.replace("/login"); return; }
        if (auth.user?.role !== "watu_admin") { router.replace("/dashboard"); return; }
      } catch {
        router.replace("/login");
        return;
      }
      try {
        const data = await listAllowedEmails();
        setEmails(data.emails);
      } catch {
        setError("Could not load allowlist.");
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

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    setError(null);
    try {
      const res = await addAllowedEmail(email, newNotes.trim() || undefined);
      setEmails((prev) => [res.item, ...prev]);
      setNewEmail("");
      setNewNotes("");
      showToast(`${email} added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add email.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: number, email: string) {
    setRemoving(id);
    setError(null);
    try {
      await removeAllowedEmail(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      showToast(`${email} removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove email.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Allowed Emails</h1>
          <p className="admin-subtitle">
            Only emails on this list can request a login code. Add emails before users try to sign in.
          </p>
        </div>
        <a className="admin-nav-link" href="/admin/users">← User accounts</a>
      </div>

      {toast ? <p className="admin-toast" role="status">{toast}</p> : null}
      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      <div className="admin-card">
        <h2 className="admin-section-title">Add email</h2>
        <form className="allowed-email-form" onSubmit={handleAdd}>
          <input
            className="admin-input"
            inputMode="email"
            placeholder="name@example.com"
            required
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Notes (optional)"
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <button className="admin-action-btn admin-action-approve" disabled={adding} type="submit">
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="admin-section-title">
          Allowlist
          {!loading ? <span className="admin-badge-count">{emails.length}</span> : null}
        </h2>

        {loading ? (
          <p className="admin-loading">Loading…</p>
        ) : emails.length === 0 ? (
          <p className="admin-empty">No emails added yet. Add one above.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Notes</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emails.map((item) => (
                <tr key={item.id}>
                  <td className="admin-cell-primary">{item.email}</td>
                  <td>{item.notes ?? <span className="admin-muted">—</span>}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <button
                      className="admin-action-btn admin-action-suspend"
                      disabled={removing === item.id}
                      type="button"
                      onClick={() => handleRemove(item.id, item.email)}
                    >
                      {removing === item.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
