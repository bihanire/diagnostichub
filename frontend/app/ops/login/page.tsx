"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getOpsSession, loginOps } from "@/lib/api";
import { uiCopy } from "@/lib/copy";

export default function OpsLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      try {
        const session = await getOpsSession();
        if (mounted && session.authenticated) {
          router.replace("/insights");
          return;
        }
      } catch {
        // If the check fails, keep the user on the sign-in page.
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    void verifySession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setError(uiCopy.opsLogin.form.emptyPassword);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await loginOps(password);
      if (!response.authenticated) {
        setError(response.message || uiCopy.opsLogin.form.invalidPassword);
        return;
      }
      router.push("/insights");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : uiCopy.opsLogin.form.signInFailure
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell" id="main-content">
      <section className="hero hero-split">
        <div className="hero-copy">
          <span className="eyebrow">{uiCopy.opsLogin.hero.eyebrow}</span>
          <h1>{uiCopy.opsLogin.hero.title}</h1>
          <p>{uiCopy.opsLogin.hero.description}</p>
          <div className="chip-row hero-chip-row">
            {uiCopy.opsLogin.hero.chips.map((chip) => (
              <span className="chip chip-hero" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-card">
            <span className="eyebrow">{uiCopy.opsLogin.hero.sideEyebrow}</span>
            <p className="body-copy">{uiCopy.opsLogin.hero.sideDescription}</p>
          </div>
        </div>
      </section>

      <section className="panel login-panel">
        <div className="panel-header">
          <span className="eyebrow">{uiCopy.opsLogin.form.eyebrow}</span>
          <h3>{uiCopy.opsLogin.form.title}</h3>
        </div>

        {checkingSession ? (
          <p className="muted-copy" role="status">
            {uiCopy.opsLogin.form.checkingLabel}
          </p>
        ) : (
          <form className="search-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="ops-password">
              {uiCopy.opsLogin.form.fieldLabel}
            </label>
            <input
              id="ops-password"
              className="text-input"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={uiCopy.opsLogin.form.placeholder}
              type="password"
              value={password}
            />
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? uiCopy.opsLogin.form.submittingLabel : uiCopy.opsLogin.form.submitLabel}
            </button>
          </form>
        )}

        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        <div className="action-grid">
          <Link className="secondary-button inline-action" href="/">
            {uiCopy.global.backToApp}
          </Link>
        </div>
      </section>
    </main>
  );
}
