import { listAuditTimeline } from '@/lib/governance/audit-query';

function readPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return {} as Record<string, unknown>;
  return payload as Record<string, unknown>;
}

export default async function AuditPage() {
  const events = await listAuditTimeline(100);

  return (
    <main className="content" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Governance evidence</p>
          <h1>Audit timeline</h1>
          <p className="lede">Allowed and denied agent actions are persisted with actor, task, execution, policy and reason metadata.</p>
        </div>
        <a className="primary" href="/">Back to dashboard</a>
      </header>

      <section className="card">
        {events.length === 0 ? (
          <div className="empty-state">
            <strong>No audit events yet</strong>
            <p>Governed agent actions will appear here after capability enforcement runs.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {events.map((event) => {
              const payload = readPayload(event.payload);
              const metadata = readPayload(payload.metadata);
              return (
                <article key={event.id} className="card" style={{ margin: 0 }}>
                  <div className="card-heading">
                    <div>
                      <p className="eyebrow">{String(payload.severity ?? 'info').toUpperCase()}</p>
                      <h2 style={{ marginBottom: 6 }}>{event.eventType}</h2>
                      <p style={{ margin: 0 }}>
                        {event.actorType} · {event.actorId ?? 'unknown actor'}
                      </p>
                    </div>
                    <span className="pill">{String(payload.reasonCode ?? 'no reason code')}</span>
                  </div>
                  <ul className="policy-list">
                    <li><span>Task</span><strong>{event.taskId ?? '—'}</strong></li>
                    <li><span>Execution</span><strong>{event.executionId ?? '—'}</strong></li>
                    <li><span>Policy</span><strong>{String(payload.policyVersion ?? '—')}</strong></li>
                    <li><span>Capability</span><strong>{String(metadata.capability ?? '—')}</strong></li>
                    <li><span>Recorded</span><strong>{event.createdAt.toISOString()}</strong></li>
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
