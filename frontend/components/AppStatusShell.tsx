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

type BatteryManagerLike = {
  charging: boolean;
  level: number;
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

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    if (typeof window.matchMedia !== "function") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (!window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    const selector = "a, button, summary, [data-magnetic]";
    let activeElement: HTMLElement | null = null;
    const magneticStrength = 4;

    function resetElement(element: HTMLElement) {
      element.style.removeProperty("--magnetic-x");
      element.style.removeProperty("--magnetic-y");
      element.classList.remove("magnetic-active");
    }

    function handlePointerMove(event: PointerEvent) {
      const target = (event.target as Element | null)?.closest(selector) as HTMLElement | null;
      if (!target) {
        if (activeElement) {
          resetElement(activeElement);
          activeElement = null;
        }
        return;
      }

      if (activeElement !== target) {
        if (activeElement) {
          resetElement(activeElement);
        }
        activeElement = target;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const relativeX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const relativeY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      const x = Math.max(-1, Math.min(1, relativeX)) * magneticStrength;
      const y = Math.max(-1, Math.min(1, relativeY)) * magneticStrength;

      target.style.setProperty("--magnetic-x", `${x.toFixed(2)}px`);
      target.style.setProperty("--magnetic-y", `${y.toFixed(2)}px`);
      target.classList.add("magnetic-active");
    }

    function handlePointerLeave() {
      if (!activeElement) {
        return;
      }
      resetElement(activeElement);
      activeElement = null;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      if (activeElement) {
        resetElement(activeElement);
      }
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") {
      return;
    }

    let batteryManager: BatteryManagerLike | null = null;
    const batteryAwareNavigator = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
      connection?: NetworkInformation;
    };

    const updateLowPowerClass = () => {
      const connection = batteryAwareNavigator.connection;
      const connectionLowPower = Boolean(connection?.saveData);
      const batteryLowPower =
        batteryManager !== null && !batteryManager.charging && batteryManager.level <= 0.25;
      document.body.classList.toggle("low-power-visuals", connectionLowPower || batteryLowPower);
    };
    const batteryEvents = ["levelchange", "chargingchange"] as const;

    updateLowPowerClass();

    let active = true;
    batteryAwareNavigator
      .getBattery?.()
      .then((battery) => {
        if (!active) {
          return;
        }
        batteryManager = battery;
        batteryEvents.forEach((eventName) => {
          battery.addEventListener?.(eventName, updateLowPowerClass);
        });
        updateLowPowerClass();
      })
      .catch(() => {
        // Battery API is optional. Keep enhancement silent when unavailable.
      });

    return () => {
      active = false;
      if (batteryManager) {
        batteryEvents.forEach((eventName) => {
          batteryManager?.removeEventListener?.(eventName, updateLowPowerClass);
        });
      }
      document.body.classList.remove("low-power-visuals");
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    const utilitySummary = document.querySelector<HTMLElement>(".site-utility-trigger");
    if (!utilitySummary) {
      return;
    }

    let lastToggleAt = 0;
    const debounceMs = 220;

    const handleClick = (event: MouseEvent) => {
      const now = performance.now();
      if (now - lastToggleAt < debounceMs) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lastToggleAt = now;
    };

    utilitySummary.addEventListener("click", handleClick, true);
    return () => {
      utilitySummary.removeEventListener("click", handleClick, true);
    };
  }, [mounted]);

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
