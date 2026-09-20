'use client';

import { useEffect, useMemo, useState } from 'react';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';

type Approval = {
  approvalId: string;
  action: string;
  status: string;
  requestedAt: string;
  executionId: string | null;
  provenance: {
    firstClassBound: boolean;
    executionId: string | null;
    resourceType: string | null;
    resourceId: string | null;
  };
  task: { id: string; title: string; status: string };
  repository: string;
  decisionEndpoint: string | null;
  actionable: boolean;
  warning: string | null;
};

type ApprovalResponse = {
  ok: boolean;
  count: number;
  firstClassBound: number;
  unbound: number;
  approvals: Approval[];
};

export default function ApprovalsPage() {
  const [data, setData] = useState<ApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/github/approvals', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to load approvals.');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const actionable = useMemo(() => data?.approvals.filter((a) => a.actionable) ?? [], [data]);
  const historical = useMemo(() => data?.approvals.filter((a) => !a.actionable) ?? [], [data]);

  async function decide(approval: Approval, decision: 'APPROVE' | 'REJECT') {
    setBusyId(approval.approvalId);
    setError(null);
    setNotice(null);

    try {
      const isMerge = approval.action.startsWith('pr.merge:');
      const payload = isMerge
        ? {
            approvalId: approval.approvalId,
            decision,
            action: 'DECIDE',
            reason: `Decision from GitAgent approvals UI: ${decision}`,
          }
        : {
            approvalId: approval.approvalId,
            executionId: approval.executionId,
            decision,
            reason: `Decision from GitAgent approvals UI: ${decision}`,
          };

      const response = await fetch(approval.decisionEndpoint ?? '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Approval decision failed.');
      setNotice(`${decision} recorded for ${approval.action}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function executeMerge(approval: Approval) {
    setBusyId(approval.approvalId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/github/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.approvalId, action: 'EXECUTE' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Merge execution failed.');
      setNotice(`Merge execution completed for ${approval.action}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ControlPlaneShell active="/approvals" title="Human decisions" subtitle={`${data?.count ?? 0} pending`}>
      <div className="section-head">
        <div>
          <p className="kicker">Control plane / Approvals</p>
          <h1>Human decisions</h1>
        </div>
        <button className="ghost-button" onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <section className="command-strip approvals-summary">
        <div><span className="label">Pending</span><strong>{data?.count ?? 0}</strong></div>
        <div><span className="label">Exactly bound</span><strong>{data?.firstClassBound ?? 0}</strong></div>
        <div><span className="label">Historical / unbound</span><strong>{data?.unbound ?? 0}</strong></div>
        <div><span className="label">Decision model</span><strong>Human gated</strong><small>Approval and merge execution are separate transitions.</small></div>
        <div><span className="label">Policy</span><strong>2026-09-16.1</strong></div>
      </section>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-label">ACTIONABLE</span>
            <h2>Pending approvals with exact provenance</h2>
          </div>
          <span className="counter">{actionable.length}</span>
        </div>

        {loading ? (
          <div className="separation-rule">Loading approvals…</div>
        ) : actionable.length === 0 ? (
          <div className="separation-rule">No actionable approvals are waiting.</div>
        ) : (
          actionable.map((approval) => (
            <div className="approval-row" key={approval.approvalId}>
              <div className="approval-main">
                <div className="approval-title-row">
                  <strong>{approval.action}</strong>
                  <span className="task-state">{approval.task.status}</span>
                </div>
                <span>{approval.task.title}</span>
                <small className="mono muted">execution: {approval.executionId ?? '—'}</small>
                <small className="mono muted">resource: {approval.provenance.resourceType ?? '—'} / {approval.provenance.resourceId ?? '—'}</small>
              </div>
              <div className="approval-meta">
                <span>{approval.repository}</span>
                <span>{new Date(approval.requestedAt).toLocaleString()}</span>
              </div>
              <div className="approval-actions">
                <button className="ghost-button" disabled={busyId === approval.approvalId} onClick={() => decide(approval, 'REJECT')}>Reject</button>
                <button className="solid-button" disabled={busyId === approval.approvalId} onClick={() => decide(approval, 'APPROVE')}>Approve</button>
                {approval.action.startsWith('pr.merge:') && approval.status === 'APPROVED' && (
                  <button className="ghost-button" disabled={busyId === approval.approvalId} onClick={() => executeMerge(approval)}>Execute merge</button>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">HISTORICAL</span>
            <h2>Legacy approvals without safe provenance</h2>
          </div>
          <span className="counter">{historical.length}</span>
        </div>

        {historical.length === 0 ? (
          <div className="separation-rule">No historical unbound approvals.</div>
        ) : (
          historical.map((approval) => (
            <div className="approval-row historical" key={approval.approvalId}>
              <div className="approval-main">
                <strong>{approval.action}</strong>
                <span>{approval.task.title}</span>
                <small>{approval.warning}</small>
              </div>
              <div className="approval-meta"><span>{approval.repository}</span><span>non-actionable</span></div>
              <div className="approval-actions"><span className="task-state">LOCKED</span></div>
            </div>
          ))
        )}
      </section>
    </ControlPlaneShell>
  );
}
