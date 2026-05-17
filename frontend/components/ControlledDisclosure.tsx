"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

type ControlledDisclosureProps = {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  eyebrow?: string;
  id?: string;
  title: string;
  actionLabel?: string;
  openLabel?: string;
  closeLabel?: string;
};

export function ControlledDisclosure({
  children,
  className = "",
  defaultOpen = false,
  eyebrow,
  id,
  title,
  actionLabel,
  openLabel = "Open",
  closeLabel = "Close",
}: ControlledDisclosureProps) {
  const generatedId = useId();
  const contentId = id || `disclosure-${generatedId}`;
  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeIfOutside(event: PointerEvent | FocusEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("focusin", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("focusin", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <section
      className={`detail-toggle controlled-disclosure ${open ? "is-open" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="detail-toggle-summary"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <div className="panel-header">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
        </div>
        <span className="detail-toggle-action">{open ? closeLabel : actionLabel || openLabel}</span>
      </button>
      {open ? (
        <div className="detail-toggle-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
