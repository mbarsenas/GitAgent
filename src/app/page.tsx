import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';

const nav = [
  { label: 'Overview', href: '/' },
  { label: 'Executions', href: '/executions' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Audit', href: '/audit' },
  { label: 'GitHub', href: '/settings/github' },
];

function payloadRecord(payload: unknown) {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

export default async function Home() {
  const repository = await prisma.repository.findFirst({
    where: { provider: 'github', externalId: '1373462743' },
  });

  const [agents, tasks, executions, pendingApprovals, auditEvents, securityRun] = await Promise.all([
    prisma.agent.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          ...(repository ? [{ repositoryId: repository.id }] : []),
          { repositoryId: null, grants: { some: { capability: 'review.approve', effect: 'ALLOW' } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
    }),
    prisma.task.findMany({
      where: repository ? { repositoryId: repository.id } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agent: true },
    }),
    prisma.execution.findMany({
      where: repository ? { task: { repositoryId: repository.id } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { task: true, agent: true, workspace: true },
    }),
    prisma.approval.findMany({
      where: { status: 'PENDING', ...(repository ? { task: { repositoryId: repository.id } } : {}) },
      orderBy: { requestedAt: 'asc' },
      take: 8,
      include: { task: true },
    }),
    prisma.auditEvent.findMany({
      where: repository ? { task: { repositoryId: repository.id } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.auditEvent.findFirst({ where: { eventType: 'security.suite.completed' }, orderBy: { createdAt: 'desc' } }),
  ]);

  const trust = await Promise.all(
    agents.map(async (agent) => ({
      ...agent,
      trustState: await getAgentTrustState(agent.id),
    })),
  );

  const activeTaskCount = tasks.filter((task) => ['QUEUED', 'RUNNING', 'WAITING_APPROVAL'].includes(task.status)).length;
  const activeWorkspaces = executions.filter((execution) => execution.workspace?.status === 'ACTIVE').length;
  const sealedWorkspaces = executions.filter((execution) => execution.workspace?.status === 'SEALED').length;
  const boundPending = pendingApprovals.filter((approval) => approval.executionId && approval.resourceType && approval.resourceId).length;
  const securityPayload = payloadRecord(securityRun?.payload);
  const securityPassed = securityPayload.passed === true;

  return (
    <main className="workspace">
      <header className="chrome">
        <div className="product-mark">
          <span className="mark-box">GA</span>
          <div><strong>GitAgent</strong><span>control plane</span></div>
        </div>
        <div className="repo-context">
          <span className="muted">repository</span>
          <strong>{repository ? `${repository.owner} / ${repository.name}` : 'No repository connected'}</strong>
          <span className="branch">{repository?.defaultBranch ?? '—'}</span>
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/approvals">Approvals</a>
          <a className="ghost-button" href="/executions">Executions</a>
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
        <div className="rail-footer"><span className="status-dot" />policy engine online</div>
      </aside>

      <section className="main-panel">
        <div className="section-head">
          <div><p className="kicker">Workspace / Overview</p><h1>Agent operations</h1></div>
          <div className="head-meta"><span>Policy</span><strong>2026-09-16.1</strong></div>
        </div>

        <section className="metric-grid">
          <article className="metric-card"><span>Active tasks</span><strong>{activeTaskCount}</strong><small>{tasks.length} recent tasks</small></article>
          <article className="metric-card"><span>Pending approvals</span><strong>{pendingApprovals.length}</strong><small>{boundPending} provenance-bound</small></article>
          <article className="metric-card"><span>Active workspaces</span><strong>{activeWorkspaces}</strong><small>{sealedWorkspaces} sealed</small></article>
          <article className="metric-card"><span>Security suite</span><strong>{securityPassed ? 'PASS' : 'UNKNOWN'}</strong><small>{Number(securityPayload.totalChecks ?? 0)} controls</small></article>
        </section>

        <section className="ops-grid">
          <article className="panel span-2">
            <div className="panel-head"><div><span className="panel-label">EXECUTIONS</span><h2>Recent governed work</h2></div><a className="text-link" href="/executions">Open executions →</a></div>
            {executions.length === 0 ? <div className="separation-rule">No executions yet.</div> : executions.map((execution) => (
              <a className="execution-row" key={execution.id} href={`/executions/${execution.id}`}>
                <div><strong>{execution.task.title}</strong><span>{execution.id}</span></div>
                <div><span className="label">Agent</span><strong>{execution.agent.name}</strong></div>
                <div><span className="label">Execution</span><strong>{execution.status}</strong></div>
                <div><span className="label">Workspace</span><strong>{execution.workspace?.status ?? 'NONE'}</strong></div>
                <div><span className="label">Branch</span><strong>{execution.workspace?.branch ?? '—'}</strong></div>
              </a>
            ))}
          </article>

          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">AGENTS</span><h2>Identity and trust</h2></div></div>
            {trust.map((agent) => (
              <div className="identity-row" key={agent.id}>
                <span className="avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{agent.name}</strong><span>{agent.providerKey}/{agent.model}</span><small className={`trust ${agent.trustState.toLowerCase()}`}>{agent.trustState}</small></div>
              </div>
            ))}
          </article>

          <article className="panel span-2">
            <div className="panel-head"><div><span className="panel-label">APPROVALS</span><h2>Human gates</h2></div><a className="text-link" href="/approvals">Open approvals →</a></div>
            {pendingApprovals.length === 0 ? <div className="separation-rule">No pending approvals.</div> : pendingApprovals.map((approval) => (
              <div className="approval-row compact" key={approval.id}>
                <div className="approval-main"><strong>{approval.action}</strong><span>{approval.task.title}</span><small>{approval.executionId ? `execution ${approval.executionId}` : 'historical / unbound'}</small></div>
                <div className="approval-meta"><span>{approval.resourceType ?? '—'}</span><span>{approval.resourceId ?? '—'}</span></div>
                <div className="approval-actions"><span className={`task-state ${approval.executionId ? '' : 'locked'}`}>{approval.executionId ? 'ACTIONABLE' : 'LOCKED'}</span></div>
              </div>
            ))}
          </article>

          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">TASKS</span><h2>Recent task state</h2></div><a className="text-link" href="/tasks/new">New task →</a></div>
            <div className="guardrail-list">
              {tasks.slice(0, 6).map((task) => <div key={task.id}><span>{task.title}</span><strong>{task.status}</strong></div>)}
            </div>
          </article>

          <article className="panel span-2">
            <div className="panel-head"><div><span className="panel-label">AUDIT</span><h2>Recent governance evidence</h2></div><a className="text-link" href="/audit">Open audit →</a></div>
            <div className="event-table">
              {auditEvents.map((event) => {
                const payload = payloadRecord(event.payload);
                return (
                  <div className="event-row" key={event.id}>
                    <div className="event-summary">{event.eventType}</div>
                    <div className="event-evidence">
                      <span className="mono muted">{event.createdAt.toISOString().slice(11, 19)}</span>
                      <span className="severity info">INFO</span>
                      <strong className="mono">{event.actorType}</strong>
                      <span>{event.actorId ?? 'system'}{typeof payload.reasonCode === 'string' ? ` · ${payload.reasonCode}` : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">GUARDRAILS</span><h2>Policy boundary</h2></div></div>
            <div className="guardrail-list">
              <div><span>Self approval</span><strong className="deny">DENY</strong></div>
              <div><span>Protected branch write</span><strong className="deny">DENY</strong></div>
              <div><span>Cross-workspace write</span><strong className="deny">DENY</strong></div>
              <div><span>Agent merge</span><strong className="deny">DENY</strong></div>
              <div><span>Human merge gate</span><strong>REQUIRED</strong></div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
