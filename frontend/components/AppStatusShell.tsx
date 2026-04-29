"use client";

import { useEffect, useState } from "react";

import { uiCopy } from "@/lib/copy";

type ConnectionMode = "online" | "offline" | "slow";

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

function readConnectionMode(): ConnectionMode {
  if (typeof navigator === "undefined") {
    return "online";
  }

  if (!navigator.onLine) {
    return "offline";
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) {
    return "online";
  }

  if (connection.saveData) {
    return "slow";
  }

  if (connection.effectiveType && /(^2g$|slow-2g)/i.test(connection.effectiveType)) {
    return "slow";
  }

  return "online";
}

export function AppStatusShell() {
  const [mounted, setMounted] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("online");
  const serviceWorkerEnabled = process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "true";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const updateConnectionMode = () => {
      setConnectionMode(readConnectionMode());
    };

    updateConnectionMode();

    if (typeof window !== "undefined") {
      window.addEventListener("online", updateConnectionMode);
      window.addEventListener("offline", updateConnectionMode);
    }

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    connection?.addEventListener?.("change", updateConnectionMode);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", updateConnectionMode);
        window.removeEventListener("offline", updateConnectionMode);
      }
      connection?.removeEventListener?.("change", updateConnectionMode);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const unregisterAll = () =>
      navigator.serviceWorker
        .getRegistrations?.()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch(() => {
          // Keep cleanup failures silent.
        });

    if (!serviceWorkerEnabled) {
      unregisterAll();
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      unregisterAll();
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep registration failures silent so the branch flow never breaks.
    });
  }, [mounted, serviceWorkerEnabled]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        {uiCopy.global.skipLink}
      </a>
      {mounted && connectionMode === "offline" ? (
        <div aria-live="assertive" className="network-banner network-banner-offline" role="alert">
          {uiCopy.global.offlineBanner}
        </div>
      ) : null}
      {mounted && connectionMode === "slow" ? (
        <div aria-live="polite" className="network-banner network-banner-slow" role="status">
          {uiCopy.global.slowNetworkBanner}
        </div>
      ) : null}
    </>
  );
}
