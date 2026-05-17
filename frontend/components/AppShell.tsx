import { ReactNode } from "react";

type AppShellProps = {
  topBar: ReactNode;
  workspace: ReactNode;
  isGateway?: boolean;
};

export function AppShell({
  topBar,
  workspace,
  isGateway = false,
}: AppShellProps) {
  return (
    <section className={`lm-shell ${isGateway ? "lm-shell-gateway" : "lm-shell-workspace"}`}>
      <header className="lm-topbar-wrap">{topBar}</header>
      <div className="lm-main-grid">
        <section className="lm-workspace-wrap">{workspace}</section>
      </div>
    </section>
  );
}
