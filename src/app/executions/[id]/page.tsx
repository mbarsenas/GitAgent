import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

function payloadRecord(payload: unknown) {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

export default async function ExecutionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const execution = await prisma.execution.findUnique({
    where: { id },
    include: {
      agent: true,
      workspace: true,
      task: { include: { repository: true, initiator: true, approvals: { orderBy: { requestedAt: 'asc' } } } },
    },
  });
  if (!execution) notFound();

  const events = await prisma.auditEvent.findMany({
    where: { executionId: id },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  const prCreated = events.find((event) => event.eventType === 'github.pr.created');
  const prNumber = prCreated ? Number(payloadRecord(prCreated.payload).pullRequestNumber) : null;
  const reviewApproved = events.find((event) => event.eventType === 'github.review.approved');
  const merged = events.find((event) => event.eventType === 'github.pr.merged');

  return (
    <main className="main-panel">
      <div className="section-head">
        <div>
          <p className="kicker">Executions / {execution.id}</p>
          <h1>{execution.task.title}</h1>
        </div>
        <div className="chrome-actions">
          <a className="ghost-button" href="/executions">Executions</a>
          <a className="ghost-button" href="/approvals">Approvals</a>
        </div>
      </div>

      <section className="command-strip">
        <div><span className="label">Execution</span><strong>{execution.status}</strong><small>{execution.id}</small></div>
        <div><span className="label">Agent</span><strong>{execution.agent.name}</strong><small>{execution.agent.providerKey}/{execution.agent.model}</small></div>
        <div><span className="label">Workspace</span><strong>{execution.workspace?.status ?? 'NONE'}</strong><small>{execution.workspace?.workspaceKey ?? 'not provisioned'}</small></div>
        <div><span className="label">Pull request</span><strong>{prNumber ? `#${prNumber}` : '—'}</strong><small>{reviewApproved ? 'independent review approved' : 'awaiting review evidence'}</small></div>
        <div><span className="label">Merge</span><strong>{merged ? 'MERGED' : 'NOT MERGED'}</strong><small>{execution.task.status}</small></div>
      </section>

      <section className="ops-grid">
        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">PROVENANCE</span><h2>Execution boundary</h2></div></div>
          <div className="detail-list">
            <div><span>Repository</span><strong>{execution.task.repository.owner}/{execution.task.repository.name}</strong></div>
            <div><span>Human sponsor</span><strong>{execution.task.initiator?.name ?? execution.task.initiator?.email ?? '—'}</strong></div>
            <div><span>Branch</span><strong>{execution.workspace?.branch ?? '—'}</strong></div>
            <div><span>Workspace writable</span><strong>{execution.workspace ? String(execution.workspace.writable) : '—'}</strong></div>
            <div><span>Started</span><strong>{execution.startedAt?.toISOString() ?? '—'}</strong></div>
            <div><span>Finished</span><strong>{execution.finishedAt?.toISOString() ?? '—'}</strong></div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">APPROVALS</span><h2>Human gates</h2></div></div>
          {execution.task.approvals.length === 0 ? <div className="separation-rule">No approvals for this task.</div> : execution.task.approvals.map((approval) => (
            <div className="detail-list" key={approval.id}>
              <div><span>{approval.action}</span><strong>{approval.status}</strong></div>
              <div><span>Execution</span><strong>{approval.executionId ?? 'legacy/unbound'}</strong></div>
              <div><span>Resource</span><strong>{approval.resourceType ?? '—'} / {approval.resourceId ?? '—'}</strong></div>
            </div>
          ))}
        </article>

        <article className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head"><div><span className="panel-label">TIMELINE</span><h2>Governance evidence</h2></div><span className="counter">{events.length} events</span></div>
          <div className="timeline">
            {events.map((event) => {
              const payload = payloadRecord(event.payload);
              return (
                <div className="timeline-row" key={event.id}>
                  <span className="timeline-time">{event.createdAt.toISOString().slice(11, 19)}</span>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{event.eventType}</strong>
                    <span>{event.actorType} · {event.actorId ?? 'system'}</span>
                    {typeof payload.reasonCode === 'string' && <small>{payload.reasonCode}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}
