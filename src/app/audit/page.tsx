import { ControlPlaneShell } from '@/app/components/control-plane-shell';
import { listAuditTimeline } from '@/lib/governance/audit-query';

export const dynamic = 'force-dynamic';

function readPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return {} as Record<string, unknown>;
  return payload as Record<string, unknown>;
}

export default async function AuditPage() {
  const events = await listAuditTimeline(100);

  return (
    <ControlPlaneShell active="/audit" title="Audit timeline" subtitle={`${events.length} events`}>
      <div className="section-head">
        <div>
          <p className="kicker">Control plane / Audit</p>
          <h1>Audit timeline</h1>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-label">GOVERNANCE EVIDENCE</span>
            <h2>Allowed and denied agent actions</h2>
          </div>
          <span className="counter">{events.length} shown</span>
        </div>

        {events.length === 0 ? (
          <div className="separation-rule">No audit events yet.</div>
        ) : (
          <div className="event-table">
            {events.map((event) => {
              const payload = readPayload(event.payload);
              const metadata = readPayload(payload.metadata);
              const severity = String(payload.severity ?? 'info').toUpperCase();
              const reasonCode = String(payload.reasonCode ?? 'no reason code');

              return (
                <article key={event.id} className="event-row">
                  <div className="event-summary">
                    <strong>{event.eventType}</strong>
                    <span className={`severity ${severity.toLowerCase()}`}>{severity}</span>
                  </div>
                  <div className="event-evidence">
                    <span className="mono muted">{event.createdAt.toISOString().slice(11, 19)}</span>
                    <span>{event.actorType}</span>
                    <strong className="mono">{event.actorId ?? 'unknown actor'}</strong>
                    <span>{reasonCode}</span>
                  </div>
                  <div className="audit-meta-grid">
                    <div><span className="label">Task</span><strong className="mono">{event.taskId ?? '—'}</strong></div>
                    <div><span className="label">Execution</span><strong className="mono">{event.executionId ?? '—'}</strong></div>
                    <div><span className="label">Policy</span><strong>{String(payload.policyVersion ?? '—')}</strong></div>
                    <div><span className="label">Capability</span><strong>{String(metadata.capability ?? '—')}</strong></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </ControlPlaneShell>
  );
}
