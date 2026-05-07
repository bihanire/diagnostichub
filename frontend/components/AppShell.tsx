import { ReactNode } from "react";

type AppShellProps = {
  topBar: ReactNode;
  learningRail: ReactNode;
  workspace: ReactNode;
  contextPanel: ReactNode;
  statusStrip: ReactNode;
};

export function AppShell({
  topBar,
  learningRail,
  workspace,
  contextPanel,
  statusStrip,
}: AppShellProps) {
  return (
    <section className="lm-shell">
      <div className="lm-shell-ambient" aria-hidden="true">
        <span className="lm-shell-aura lm-shell-aura-left" />
        <span className="lm-shell-aura lm-shell-aura-right" />
      </div>
      <header className="lm-topbar-wrap">{topBar}</header>
      <div className="lm-main-grid">
        <aside className="lm-rail-wrap">{learningRail}</aside>
        <section className="lm-workspace-wrap">{workspace}</section>
        <aside className="lm-context-wrap">{contextPanel}</aside>
      </div>
      <footer className="lm-status-wrap">{statusStrip}</footer>
    </section>
  );
}
