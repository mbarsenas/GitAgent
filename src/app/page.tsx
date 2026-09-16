const nav = [
  { label: 'Overview', href: '/' },
  { label: 'Repositories', href: '#repositories' },
  { label: 'Agents', href: '#agents' },
  { label: 'Tasks', href: '#tasks' },
  { label: 'Approvals', href: '#approvals' },
  { label: 'Audit', href: '/audit' },
];

const activity = [
  { time: '14:32:08', event: 'capability.denied', detail: 'implementation-agent-1 · review.approve', severity: 'HIGH' },
  { time: '14:31:44', event: 'execution.started', detail: 'task-1 · implementation-agent-1', severity: 'INFO' },
  { time: '14:31:42', event: 'sponsorship.granted', detail: 'task-1 · scope: branch + PR', severity: 'INFO' },
];

export default function Home() {
  return (
    <main className="workspace">
      <header className="chrome">
        <div className="product-mark">
          <span className="mark-box">GA</span>
          <div>
            <strong>GitAgent</strong>
            <span>control plane</span>
          </div>
        </div>
        <div className="repo-context">
          <span className="muted">workspace</span>
          <strong>mbarsenas / GitAgent</strong>
          <span className="branch">main</span>
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/demo">Run adversarial test</a>
          <button className="solid-button">New task</button>
        </div>
      </header>

      <aside className="rail">
        <nav>
          {nav.map((item, index) => (
            <a key={item.label} href={item.href} className={index === 0 ? 'active' : ''}>
              <span className="nav-index">0{index + 1}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="rail-footer">
          <span className="status-dot" />
          policy engine online
        </div>
      </aside>

      <section className="main-panel">
        <div className="section-head">
          <div>
            <p className="kicker">Workspace / Overview</p>
            <h1>Agent operations</h1>
          </div>
          <div className="head-meta">
            <span>Policy</span>
            <strong>2026-09-16.1</strong>
          </div>
        </div>

        <section className="command-strip">
          <div>
            <span className="label">Repository</span>
            <strong>GitAgent</strong>
          </div>
          <div>
            <span className="label">Default branch</span>
            <strong>main</strong>
          </div>
          <div>
            <span className="label">Trust mode</span>
            <strong>Selective</strong>
          </div>
          <div>
            <span className="label">Review boundary</span>
            <strong>Independent</strong>
          </div>
          <div>
            <span className="label">Runtime</span>
            <strong>Isolated</strong>
          </div>
        </section>

        <section className="ops-grid">
          <article className="panel span-2" id="tasks">
            <div className="panel-head">
              <div>
                <span className="panel-label">TASKS</span>
                <h2>Execution queue</h2>
              </div>
              <span className="counter">1 active</span>
            </div>

            <div className="task-row">
              <div className="task-state running">RUNNING</div>
              <div className="task-main">
                <strong>task-1 · adversarial governance test</strong>
                <span>implementation-agent-1 · OpenAI/Codex · branch scope only</span>
              </div>
              <div className="task-metric">
                <span>Budget</span>
                <strong>$0.24 / $1.00</strong>
              </div>
              <div className="task-metric">
                <span>Elapsed</span>
                <strong>00:02:14</strong>
              </div>
            </div>

            <div className="task-empty">
              <span className="prompt">+</span>
              <span>Create another governed agent task</span>
            </div>
          </article>

          <article className="panel" id="agents">
            <div className="panel-head">
              <div>
                <span className="panel-label">AGENTS</span>
                <h2>Identity boundary</h2>
              </div>
            </div>
            <div className="identity-row">
              <span className="avatar impl">I</span>
              <div>
                <strong>implementation-agent-1</strong>
                <span>write branch · create PR</span>
              </div>
            </div>
            <div className="identity-row">
              <span className="avatar review">R</span>
              <div>
                <strong>review-agent-1</strong>
                <span>read diff · approve/deny</span>
              </div>
            </div>
            <div className="separation-rule">Credentials and workspaces are isolated.</div>
          </article>

          <article className="panel span-2" id="audit">
            <div className="panel-head">
              <div>
                <span className="panel-label">AUDIT</span>
                <h2>Live governance events</h2>
              </div>
              <a className="text-link" href="/audit">Open timeline →</a>
            </div>
            <div className="event-table">
              {activity.map((item) => (
                <div className="event-row" key={`${item.time}-${item.event}`}>
                  <span className="mono muted">{item.time}</span>
                  <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
                  <strong className="mono">{item.event}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="approvals">
            <div className="panel-head">
              <div>
                <span className="panel-label">POLICY</span>
                <h2>Guardrails</h2>
              </div>
            </div>
            <div className="guardrail-list">
              <div><span>Self approval</span><strong className="deny">DENY</strong></div>
              <div><span>Protected branch write</span><strong className="deny">DENY</strong></div>
              <div><span>Production deploy</span><strong>HUMAN</strong></div>
              <div><span>Secret access</span><strong>GRANT</strong></div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
