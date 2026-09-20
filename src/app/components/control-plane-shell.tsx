import type { ReactNode } from 'react';

const navItems = [
  { label: 'Overview', href: '/console' },
  { label: 'Executions', href: '/executions' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'New task', href: '/tasks/new' },
  { label: 'AI Policy Builder', href: '/policy-builder' },
  { label: 'Audit', href: '/audit' },
  { label: 'GitHub', href: '/settings/github' },
];

const logo = "data:image/webp;base64,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";

export function ControlPlaneShell({ children, active, title, subtitle }: { children: ReactNode; active: string; title: string; subtitle?: string; }) {
  return (
    <main className="workspace">
      <header className="chrome">
        <a className="product-mark" href="/console">
          <img src={logo} alt="GitAgent mascot" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent)' }} />
          <div><strong>GitAgent</strong><span>control plane</span></div>
        </a>
        <div className="repo-context">
          <span className="muted">control plane</span>
          <strong>{title}</strong>
          {subtitle ? <span className={`branch${subtitle.includes('CONNECTED') ? ' status-positive' : ''}`}>{subtitle}</span> : null}
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/approvals">Approvals</a>
          <a className="solid-button" href="/tasks/new">New task</a>
          <a className="ghost-button signout-button" href="/api/auth/signout">Sign out</a>
        </div>
      </header>

      <aside className="rail">
        <nav>
          {navItems.map((item, index) => (
            <a key={item.href} href={item.href} className={active === item.href ? 'active' : ''}>
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="rail-footer"><span className="status-dot" />policy engine online</div>
      </aside>

      <section className="main-panel">{children}</section>
    </main>
  );
}
