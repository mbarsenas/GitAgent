const stats = [
  { label: 'Repositories', value: '0' },
  { label: 'Active agents', value: '0' },
  { label: 'Running tasks', value: '0' },
  { label: 'Pending approvals', value: '0' },
];

const nav = ['Repositories', 'Agents', 'Tasks', 'Approvals', 'Audit'];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">GitAgent</div>
          <div className="tagline">AI-native Git control plane</div>
        </div>
        <nav>
          {nav.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>
          ))}
        </nav>
        <div className="status">Control plane · MVP</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">GitAgent Control Plane</p>
            <h1>Govern AI work like production infrastructure.</h1>
            <p className="lede">Repositories, agents, tasks, approvals, budgets and audit trails in one execution model.</p>
          </div>
          <button className="primary">New agent task</button>
        </header>

        <section className="stats">
          {stats.map((stat) => (
            <article key={stat.label} className="card stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="grid">
          <article className="card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Execution</p>
                <h2>Agent task queue</h2>
              </div>
              <span className="pill">Ready</span>
            </div>
            <div className="empty-state">
              <strong>No agent tasks yet</strong>
              <p>Create a bounded task with an explicit model, permission scope, budget and approval policy.</p>
            </div>
          </article>

          <article className="card">
            <p className="eyebrow">Safety boundary</p>
            <h2>Default policy</h2>
            <ul className="policy-list">
              <li><span>Protected branch writes</span><strong>Deny</strong></li>
              <li><span>Production deployment</span><strong>Human approval</strong></li>
              <li><span>Secret access</span><strong>Explicit grant</strong></li>
              <li><span>Network access</span><strong>Restricted</strong></li>
            </ul>
          </article>
        </section>

        <section className="card architecture">
          <p className="eyebrow">Core principle</p>
          <h2>AI agents are identities, not invisible automation.</h2>
          <p>Every execution links the human initiator, agent, model, repository, capabilities, budget, approvals, commands, changes, tests and resulting pull request into one auditable timeline.</p>
        </section>
      </section>
    </main>
  );
}
