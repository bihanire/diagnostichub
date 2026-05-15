import fs from "node:fs";
import path from "node:path";

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopCommandBar } from "@/components/TopCommandBar";
import type { RepairFamilySummary } from "@/lib/types";

const families: RepairFamilySummary[] = [
  {
    id: "display",
    title: "Display & Vision",
    hint: "Cracked screens, lines, tint, and touch faults.",
    symptom_prompts: ["green line", "yellow screen"],
    procedure_count: 4,
  },
  {
    id: "power",
    title: "Power & Thermal",
    hint: "No power, charging, battery, and heat issues.",
    symptom_prompts: ["not charging"],
    procedure_count: 5,
  },
];

function renderTopbar() {
  const callbacks = {
    onFocusSearch: vi.fn(),
    onGoHome: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onSelectFamily: vi.fn(),
  };

  render(
    <div>
      <TopCommandBar families={families} selectedFamilyId={null} {...callbacks} />
      <main data-testid="app-body">Body</main>
    </div>
  );

  return callbacks;
}

describe("TopCommandBar dropdown behavior", () => {
  it("closes the family menu after selecting a family", async () => {
    const user = userEvent.setup();
    const callbacks = renderTopbar();

    await user.click(screen.getByRole("button", { name: "Families" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open display & vision diagnosis family/i }));

    expect(callbacks.onSelectFamily).toHaveBeenCalledWith("display");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("frames families as an operational router before flow selection", async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole("button", { name: "Families" }));

    expect(screen.getByLabelText(/family operational router/i)).toBeInTheDocument();
    expect(screen.getByText(/choose family, then flow/i)).toBeInTheDocument();
    expect(screen.getByText("1 Family")).toBeInTheDocument();
    expect(screen.getByText("2 Flow")).toBeInTheDocument();
    expect(screen.getByText("3 Guided workspace")).toBeInTheDocument();
    expect(screen.getByText("4 flows")).toBeInTheDocument();
  });

  it("closes open menus on outside click and Escape", async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole("button", { name: "Families" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByTestId("app-body"));
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Utilities" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("keeps dropdown layering above the route workspace by CSS contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

    expect(css).toContain("Overlay layering contract");
    expect(css).toMatch(/\.lm-topbar-wrap\s*\{[\s\S]*z-index:\s*1200/);
    expect(css).toMatch(/\.lm-family-menu-panel\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*9999/);
    expect(css).toMatch(/\.lm-family-menu-panel,\s*\n\.lm-utility-panel\s*\{[\s\S]*z-index:\s*1300/);
    expect(css).toMatch(/\.lm-workspace-wrap,\s*\n\.lm-context-wrap,\s*\n\.lm-rail-wrap\s*\{[\s\S]*overflow:\s*visible/);
  });
});
