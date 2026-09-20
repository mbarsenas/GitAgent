import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';

export const dynamic = 'force-dynamic';

const nav = [
  { label: 'Overview', href: '/console' },
  { label: 'Executions', href: '/executions' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Audit', href: '/audit' },
  { label: 'GitHub', href: '/settings/github' },
];

const logo = "data:image/webp;base64,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";

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
          <img src={logo} alt="GitAgent mascot" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent)' }} />
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
