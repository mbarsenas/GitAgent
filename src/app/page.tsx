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

  const [agents, tasks, executions, pendingApprovals, auditEvents, securityRun, readinessRun] = await Promise.all([
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
      take: 6,
    }),
    prisma.auditEvent.findFirst({ where: { eventType: 'security.suite.completed' }, orderBy: { createdAt: 'desc' } }),
    prisma.auditEvent.findFirst({ where: { eventType: 'readiness.checked' }, orderBy: { createdAt: 'desc' } }),
  ]);

  const trust = await Promise.all(
    agents.map(async (agent) => ({ ...agent, trustState: await getAgentTrustState(agent.id) })),
  );

  const securityPayload = payloadRecord(securityRun?.payload);
  const securityPassed = securityPayload.passed === true;
  const actionableApprovals = pendingApprovals.filter(
    (approval) => approval.executionId && approval.resourceType && approval.resourceId,
  );
  const historicalApprovals = pendingApprovals.filter(
    (approval) => !approval.executionId || !approval.resourceType || !approval.resourceId,
  );
  const activeWorkspaces = executions.filter((execution) => execution.workspace?.status === 'ACTIVE').length;
  const latestExecution = executions[0];
  const latestSuccessful = executions.find((execution) => execution.status === 'SUCCEEDED');
  const repositoryProtected = securityPassed && trust.every((agent) => agent.trustState !== 'QUARANTINED');

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
          <a className="solid-button" href="/tasks/new">Start governed task</a>
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
        <section className="client-hero panel">
          <div>
            <p className="kicker">AI software governance</p>
            <h1>Keep AI coding agents productive without giving them uncontrolled repository access.</h1>
            <p className="client-lede">
              GitAgent separates implementation, review, and merge authority so every AI-generated change follows a governed path before it reaches your default branch.
            </p>
          </div>
          <div className="protection-card">
            <span className="label">Repository status</span>
            <strong className={repositoryProtected ? 'protection-good' : 'protection-warn'}>
              {repositoryProtected ? 'PROTECTED' : 'ATTENTION'}
            </strong>
            <small>{repository ? `${repository.owner}/${repository.name}` : 'No repository connected'}</small>
          </div>
        </section>

        <section className="client-grid">
          <article className="panel attention-card">
            <div className="panel-head">
              <div><span className="panel-label">NEEDS YOUR ATTENTION</span><h2>Human decisions</h2></div>
              <span className="counter">{actionableApprovals.length}</span>
            </div>
            {actionableApprovals.length === 0 ? (
              <div className="client-empty">Nothing needs your approval right now.</div>
            ) : (
              actionableApprovals.slice(0, 4).map((approval) => (
                <div className="client-list-row" key={approval.id}>
                  <div><strong>{approval.action.startsWith('pr.merge:') ? 'Merge approval required' : 'Restricted execution approval required'}</strong><span>{approval.task.title}</span></div>
                  <a className="text-link" href="/approvals">Review →</a>
                </div>
              ))
            )}
            {historicalApprovals.length > 0 && (
              <div className="historical-note">{historicalApprovals.length} historical approval record{historicalApprovals.length === 1 ? '' : 's'} retained for audit only.</div>
            )}
          </article>

          <article className="panel posture-card">
            <div className="panel-head"><div><span className="panel-label">WHAT GITAGENT IS ENFORCING</span><h2>Protection currently active</h2></div></div>
            <div className="posture-list">
              <div><span>✓</span><strong>AI agents cannot write directly to the default branch</strong></div>
              <div><span>✓</span><strong>Implementation agents cannot approve their own changes</strong></div>
              <div><span>✓</span><strong>Independent review uses a separate agent identity</strong></div>
              <div><span>✓</span><strong>AI agents cannot merge without a human decision</strong></div>
              <div><span>✓</span><strong>Every governed action is recorded in the audit trail</strong></div>
            </div>
          </article>
        </section>

        <section className="metric-grid customer-metrics">
          <article className="metric-card"><span>Needs your approval</span><strong>{actionableApprovals.length}</strong><small>human decisions waiting</small></article>
          <article className="metric-card"><span>Active isolated workspaces</span><strong>{activeWorkspaces}</strong><small>execution-scoped boundaries</small></article>
          <article className="metric-card"><span>Latest AI change</span><strong>{latestExecution?.status ?? 'NONE'}</strong><small>{latestExecution?.task.title ?? 'No governed execution yet'}</small></article>
          <article className="metric-card"><span>Security posture</span><strong>{securityPassed ? 'PASS' : 'UNKNOWN'}</strong><small>{Number(securityPayload.totalChecks ?? 0)} controls checked</small></article>
        </section>

        <section className="panel how-it-works">
          <div className="panel-head"><div><span className="panel-label">HOW IT WORKS</span><h2>One governed path from task to merge</h2></div></div>
          <div className="steps-grid">
            {[
              ['1', 'Human sponsors a task', 'A person defines the goal, repository, agent, and policy envelope.'],
              ['2', 'Implementation agent makes the change', 'The coding agent works only inside its assigned execution boundary.'],
              ['3', 'GitAgent isolates the execution', 'Branch, workspace, and capabilities stay bound to that execution.'],
              ['4', 'Independent agent reviews it', 'A separate reviewer identity evaluates the pull request.'],
              ['5', 'Human approves the merge', 'Agents are blocked from merging the change themselves.'],
              ['6', 'GitAgent records the chain', 'Sponsorship, writes, denials, reviews, approvals, and merge are auditable.'],
            ].map(([number, title, description]) => (
              <div className="step-card" key={number}><span>{number}</span><strong>{title}</strong><small>{description}</small></div>
            ))}
          </div>
        </section>

        <section className="client-grid lower-grid">
          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">RECENT AI CHANGES</span><h2>Latest governed work</h2></div><a className="text-link" href="/executions">View all →</a></div>
            {executions.slice(0, 5).map((execution) => (
              <a className="client-list-row execution-link" key={execution.id} href={`/executions/${execution.id}`}>
                <div><strong>{execution.task.title}</strong><span>{execution.agent.name} · {execution.status}</span></div>
                <span className="task-state">{execution.workspace?.status ?? 'NO WORKSPACE'}</span>
              </a>
            ))}
          </article>

          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">AI AGENTS</span><h2>Who can act</h2></div></div>
            {trust.map((agent) => (
              <div className="identity-row" key={agent.id}>
                <span className="avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{agent.name}</strong><span>{agent.providerKey}/{agent.model}</span><small className={`trust ${agent.trustState.toLowerCase()}`}>{agent.trustState}</small></div>
              </div>
            ))}
          </article>
        </section>

        <section className="client-grid lower-grid">
          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">SECURITY POSTURE</span><h2>Governance health</h2></div></div>
            <div className="guardrail-list">
              <div><span>Security suite</span><strong>{securityPassed ? 'PASS' : 'UNKNOWN'}</strong></div>
              <div><span>Independent reviewer</span><strong>{trust.length > 1 ? 'ENABLED' : 'CHECK'}</strong></div>
              <div><span>Human merge gate</span><strong>REQUIRED</strong></div>
              <div><span>Latest successful execution</span><strong>{latestSuccessful ? 'YES' : 'NONE'}</strong></div>
              <div><span>Policy version</span><strong>2026-09-16.1</strong></div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head"><div><span className="panel-label">RECENT EVIDENCE</span><h2>Audit activity</h2></div><a className="text-link" href="/audit">Open audit →</a></div>
            <div className="event-table compact-events">
              {auditEvents.map((event) => {
                const payload = payloadRecord(event.payload);
                return (
                  <div className="event-row" key={event.id}>
                    <div className="event-summary">{event.eventType}</div>
                    <div className="event-evidence"><span>{event.actorType}</span><span>{typeof payload.reasonCode === 'string' ? payload.reasonCode : 'recorded'}</span></div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
