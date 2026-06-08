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
      <a className="lm-skip-link" href="#lm-main-content">Skip to main content</a>
      <header className="lm-topbar-wrap" role="banner">{topBar}</header>
      <main id="lm-main-content" className="lm-main-grid">
        <section className="lm-workspace-wrap">{workspace}</section>
      </main>
    </section>
  );
}
