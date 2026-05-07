import { ReactNode, useEffect, useRef } from "react";

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
  const shellRef = useRef<HTMLElement | null>(null);
  const orbRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const container = shellRef.current;
    const orb = orbRef.current;
    if (!container || !orb) {
      return;
    }

    function handleMove(event: MouseEvent) {
      const node = shellRef.current;
      const orbNode = orbRef.current;
      if (!node || !orbNode) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      orbNode.style.transform = `translate(${x * 0.04 - 20}px, ${y * 0.04 - 20}px)`;
    }

    container.addEventListener("mousemove", handleMove);
    return () => container.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <section className={`lm-shell ${isGateway ? "lm-shell-gateway" : "lm-shell-workspace"}`} ref={shellRef}>
      <div className="lm-shell-ambient" aria-hidden="true">
        <span className="lm-shell-aura lm-shell-aura-left" />
        <span className="lm-shell-aura lm-shell-aura-right" />
        <span className="lm-shell-ambient-orb" ref={orbRef} />
      </div>
      <header className="lm-topbar-wrap">{topBar}</header>
      <div className="lm-main-grid">
        <section className="lm-workspace-wrap">{workspace}</section>
        <aside className="lm-context-wrap">{contextPanel}</aside>
      </div>
      <footer className="lm-status-wrap">{statusStrip}</footer>
    </section>
  );
}
