"use client";

import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

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

        <h1 className="auth-title">Account setup required</h1>
        <p className="auth-body">
          Accounts are created by your Watu administrator. Self-registration is not available.
        </p>
        <p className="auth-body">
          If you need access, contact your Watu administrator and ask them to set up your account.
          Once they do, return here and sign in with your work email address.
        </p>

        <button
          className="primary-button"
          onClick={() => router.replace("/login")}
          type="button"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
