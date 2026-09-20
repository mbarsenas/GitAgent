import type { ReactNode } from 'react';

const navItems = [
  { label: 'Overview', href: '/' },
  { label: 'Executions', href: '/executions' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'New task', href: '/tasks/new' },
  { label: 'Audit', href: '/audit' },
  { label: 'GitHub', href: '/settings/github' },
];

export function ControlPlaneShell({
  children,
  active,
  title,
  subtitle,
}: {
  children: ReactNode;
  active: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <main className="workspace">
      <header className="chrome">
        <a className="product-mark" href="/">
          <span className="mark-box">GA</span>
          <div>
            <strong>GitAgent</strong>
            <span>control plane</span>
          </div>
        </a>
        <div className="repo-context">
          <span className="muted">control plane</span>
          <strong>{title}</strong>
          {subtitle ? (
            <span className={`branch${subtitle.includes('CONNECTED') ? ' status-positive' : ''}`}>{subtitle}</span>
          ) : null}
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/approvals">Approvals</a>
          <a className="solid-button" href="/tasks/new">New task</a>
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
        <div className="rail-footer">
          <span className="status-dot" />
          policy engine online
        </div>
      </aside>

      <section className="main-panel">{children}</section>
    </main>
  );
}
