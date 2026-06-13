"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getAuthStatus, getGoogleLoginUrl } from "@/lib/api";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled. Please try again.",
  exchange_failed: "Could not complete sign-in. Try again in a moment.",
  state_mismatch: "Security check failed. Please try again.",
  missing_params: "Sign-in failed — missing parameters. Please try again.",
  suspended: "Your account has been suspended. Contact your Watu administrator.",
};

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const error = params?.get("error") ?? null;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (status.authenticated && status.user?.approval_status === "approved") {
          router.replace("/dashboard");
        } else if (status.authenticated && status.user?.approval_status === "pending") {
          router.replace("/pending");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-loading">Checking session…</p>
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

        <h1 className="auth-title">Sign in to continue</h1>
        <p className="auth-body">
          Use your Google account to access the EC diagnostic and ticketing platform.
        </p>

        {error ? (
          <p className="auth-error" role="alert">
            {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
          </p>
        ) : null}

        <a className="auth-google-btn" href={getGoogleLoginUrl()}>
          <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>

        <p className="auth-footer">
          New here? Sign in and you will be guided through registration.
        </p>
      </div>
    </div>
  );
}
