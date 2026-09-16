import { prisma } from '@/lib/db/prisma';

const nav = [
  { label: 'Overview', href: '/' },
  { label: 'Repositories', href: '#repositories' },
  { label: 'Agents', href: '#agents' },
  { label: 'Tasks', href: '#tasks' },
  { label: 'Approvals', href: '#approvals' },
  { label: 'Audit', href: '/audit' },
  { label: 'GitHub', href: '/settings/github' },
];

function explainEvent(eventType: string, payload: unknown) {
  const data = (payload ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const capability = typeof metadata.capability === 'string' ? metadata.capability : undefined;
  const reasonCode = typeof data.reasonCode === 'string' ? data.reasonCode : undefined;

  if (eventType === 'capability.denied' && reasonCode === 'policy.self_approval_denied') {
    return 'Implementation agent tried to approve its own pull request — blocked automatically.';
  }
  if (eventType === 'sponsorship.granted') {
    return 'A human sponsor granted a bounded task-scoped capability envelope.';
  }
  if (eventType === 'execution.created') {
    return 'GitAgent created an isolated execution record for a governed task.';
  }
  if (eventType === 'capability.allowed') {
    return capability ? `GitAgent allowed ${capability} under the active policy.` : 'GitAgent allowed a governed capability.';
  }
  if (eventType === 'capability.denied') {
    return capability ? `GitAgent blocked ${capability} under the active policy.` : 'GitAgent blocked a governed capability.';
  }
  if (eventType === 'github.branch.created') return 'GitAgent created a governed GitHub branch.';
  if (eventType === 'github.commit.created') return 'GitAgent committed a governed repository change.';
  if (eventType === 'github.pr.created') return 'GitAgent opened a governed draft pull request.';
  return 'Governance event recorded by GitAgent.';
}

export default async function Home() {
  const [repository, agents, tasks, approvals, auditEvents] = await Promise.all([
    prisma.repository.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.agent.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, take: 4 }),
    prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { agent: true, executions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.approval.count({ where: { status: 'PENDING' } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  const activeTaskCount = tasks.filter((task) => ['QUEUED', 'RUNNING', 'WAITING_APPROVAL'].includes(task.status)).length;

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
          <strong>{repository ? `${repository.owner} / ${repository.name}` : 'No repository connected'}</strong>
          <span className="branch">{repository?.defaultBranch ?? '—'}</span>
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/settings/github">GitHub connection</a>
          <a className="ghost-button" href="/demo">Run adversarial test</a>
          <a className="solid-button" href="/tasks/new">New task</a>
        </div>
      </header>

      <aside className="rail">
        <nav>
          {nav.map((item, index) => (
            <a key={item.label} href={item.href} className={index === 0 ? 'active' : ''}>
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
            <strong>{repository?.name ?? 'None'}</strong>
          </div>
          <div>
            <span className="label">Default branch</span>
            <strong>{repository?.defaultBranch ?? '—'}</strong>
          </div>
          <div>
            <span className="label">Trust mode</span>
            <strong>Selective</strong>
            <small>Humans sponsor which agents can act.</small>
          </div>
          <div>
            <span className="label">Review boundary</span>
            <strong>Independent</strong>
            <small>The reviewer cannot be the same agent that wrote the code.</small>
          </div>
          <div>
            <span className="label">Runtime</span>
            <strong>Isolated</strong>
            <small>Each agent runs with separate credentials and workspace.</small>
          </div>
        </section>

        <section className="ops-grid">
          <article className="panel span-2" id="tasks">
            <div className="panel-head">
              <div>
                <span className="panel-label">TASKS</span>
                <h2>Execution queue</h2>
              </div>
              <span className="counter">{activeTaskCount} active</span>
            </div>

            {tasks.length === 0 ? (
              <a className="task-empty" href="/tasks/new">
                <span className="prompt">+</span>
                <span>Create your first governed agent task</span>
              </a>
            ) : (
              tasks.map((task) => {
                const execution = task.executions[0];
                return (
                  <div className="task-row" key={task.id}>
                    <div className={`task-state ${task.status === 'RUNNING' ? 'running' : ''}`}>{task.status}</div>
                    <div className="task-main">
                      <strong>{task.title}</strong>
                      <span>{task.agent?.name ?? 'Unassigned agent'} · {execution ? `${execution.providerKey}/${execution.model}` : 'No execution yet'}</span>
                    </div>
                    <div className="task-metric">
                      <span>Budget</span>
                      <strong>{task.maxCostUsd ? `$${Number(task.maxCostUsd).toFixed(2)}` : '—'}</strong>
                    </div>
                    <div className="task-metric">
                      <span>Execution</span>
                      <strong>{execution?.status ?? 'PENDING'}</strong>
                    </div>
                  </div>
                );
              })
            )}

            <a className="task-empty" href="/tasks/new">
              <span className="prompt">+</span>
              <span>Create another governed agent task</span>
            </a>
          </article>

          <article className="panel" id="agents">
            <div className="panel-head">
              <div>
                <span className="panel-label">AGENTS</span>
                <h2>Identity boundary</h2>
              </div>
            </div>
            {agents.length === 0 ? (
              <div className="separation-rule">No active agents yet.</div>
            ) : (
              agents.map((agent, index) => (
                <div className="identity-row" key={agent.id}>
                  <span className={`avatar ${index === 0 ? 'impl' : 'review'}`}>{agent.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{agent.name}</strong>
                    <span>{agent.providerKey}/{agent.model} · {agent.status.toLowerCase()}</span>
                  </div>
                </div>
              ))
            )}
            <div className="separation-rule">Implementation and review identities use separate credentials and workspaces.</div>
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
              {auditEvents.length === 0 ? (
                <div className="separation-rule">No audit events yet.</div>
              ) : (
                auditEvents.map((item) => {
                  const payload = (item.payload ?? {}) as Record<string, unknown>;
                  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
                  const severity = typeof payload.severity === 'string' ? payload.severity.toUpperCase() : 'INFO';
                  const capability = typeof metadata.capability === 'string' ? metadata.capability : '';
                  return (
                    <div className="event-row" key={item.id}>
                      <div className="event-summary">{explainEvent(item.eventType, item.payload)}</div>
                      <div className="event-evidence">
                        <span className="mono muted">{item.createdAt.toISOString().slice(11, 19)}</span>
                        <span className={`severity ${severity.toLowerCase()}`}>{severity}</span>
                        <strong className="mono">{item.eventType}</strong>
                        <span>{item.actorId ?? item.actorType}{capability ? ` · ${capability}` : ''}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="panel" id="approvals">
            <div className="panel-head">
              <div>
                <span className="panel-label">POLICY</span>
                <h2>Guardrails</h2>
              </div>
              <span className="counter">{approvals} pending</span>
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
