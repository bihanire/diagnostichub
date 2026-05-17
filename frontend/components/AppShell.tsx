import { ReactNode } from "react";

type AppShellProps = {
  topBar: ReactNode;
  workspace: ReactNode;
  contextPanel: ReactNode;
  statusStrip: ReactNode;
  isGateway?: boolean;
};

export function AppShell({
  topBar,
  workspace,
  contextPanel,
  statusStrip,
  isGateway = false,
}: AppShellProps) {
  return (
    <section className={`lm-shell ${isGateway ? "lm-shell-gateway" : "lm-shell-workspace"}`}>
      <header className="lm-topbar-wrap">{topBar}</header>
      <div className="lm-main-grid">
        <section className="lm-workspace-wrap">{workspace}</section>
        {isGateway ? null : <aside className="lm-context-wrap">{contextPanel}</aside>}
      </div>
      {isGateway ? null : <footer className="lm-status-wrap">{statusStrip}</footer>}
    </section>
  );
}
