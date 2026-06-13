"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getECLocations, registerUser } from "@/lib/api";
import type { ECLocationItem } from "@/lib/types";

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

export default function RegisterPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<ECLocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("UGA");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);

  useEffect(() => {
    getECLocations()
      .then((r) => setLocations(r.locations))
      .catch(() => setError("Could not load EC locations. Try refreshing the page."))
      .finally(() => setLoadingLocations(false));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) {
      setError("Please select your Experience Center location.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerUser({
        ec_location_id: parseInt(selectedLocation, 10),
        country_code: selectedCountry,
      });
      router.replace("/pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setSubmitting(false);
    }
  }

  const filteredLocations = locations.filter((l) => l.country_code === selectedCountry);

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            <span /><span />
          </span>
          <span className="auth-brand-name">Watu Simu</span>
          <span className="auth-brand-sub">Experience Center Portal</span>
        </div>

        <h1 className="auth-title">Complete your registration</h1>
        <p className="auth-body">
          Tell us which Experience Center you work at. Your account will be reviewed and approved by a Watu administrator before you can access the platform.
        </p>

        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="country">Country</label>
            <select
              className="auth-select"
              id="country"
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedLocation("");
              }}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="location">Your Experience Center</label>
            {loadingLocations ? (
              <p className="auth-loading">Loading locations…</p>
            ) : (
              <select
                className="auth-select"
                id="location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                required
              >
                <option value="">Select your EC location</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                    {loc.region ? ` — ${loc.region}` : ""}
                  </option>
                ))}
              </select>
            )}
            {!loadingLocations && filteredLocations.length === 0 ? (
              <p className="auth-hint">
                No EC locations found for this country. Your Watu administrator can add yours.
              </p>
            ) : null}
          </div>

          <button
            className="auth-submit-btn"
            disabled={submitting || !selectedLocation}
            type="submit"
          >
            {submitting ? "Submitting…" : "Submit registration"}
          </button>
        </form>

        <p className="auth-footer">
          Wrong account?{" "}
          <a className="auth-link" href="/login">Sign out and try again</a>
        </p>
      </div>
    </div>
  );
}
