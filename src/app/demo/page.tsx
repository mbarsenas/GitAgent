'use client';

import { useState } from 'react';

type DemoResult = {
  ok: boolean;
  denied: boolean;
  reasonCode?: string;
  message?: string;
  taskId?: string;
  repositoryId?: string;
  agentId?: string;
  executionId?: string;
};

export default function DemoPage() {
  const [result, setResult] = useState<DemoResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSelfApprovalTest() {
    setLoading(true);
    setResult(null);
    const response = await fetch('/api/demo/self-approval', { method: 'POST' });
    const body = (await response.json()) as DemoResult;
    setResult(body);
    setLoading(false);
  }

  const blocked = result?.denied === true;

  return (
    <main className="main-panel">
      <div className="section-head">
        <div>
          <p className="kicker">Governance / Adversarial test</p>
          <h1>Self-approval boundary</h1>
        </div>
        <a className="ghost-button" href="/">Back to control plane</a>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-label">SCENARIO</span>
            <h2>Implementation agent attempts to approve its own pull request</h2>
          </div>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 16 }}>
          <div>
            <p className="kicker">What the agent attempts</p>
            <p style={{ color: 'var(--muted)', maxWidth: 860, lineHeight: 1.6, marginBottom: 0 }}>
              GitAgent resolves the real seeded repository, task, agent, and execution records, then asks the implementation identity for the
              <code> review.approve </code> capability against its own work.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border)', background: 'var(--panel-2)', padding: 14 }}>
            <p className="kicker" style={{ marginBottom: 8 }}>Expected policy behavior</p>
            <strong style={{ display: 'block', marginBottom: 6 }}>Block the request automatically.</strong>
            <span style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
              The agent that created the change cannot approve that same change. Implementation and review identities are structurally separated.
            </span>
          </div>

          <div>
            <button className="solid-button" onClick={runSelfApprovalTest} disabled={loading}>
              {loading ? 'Running…' : 'Run self-approval test'}
            </button>
          </div>

          {result && (
            <section style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ border: '1px solid var(--border)', background: 'var(--panel-2)', padding: 16, marginBottom: 14 }}>
                <p className="kicker">Result</p>
                <h2 style={{ marginTop: 6 }}>{blocked ? 'Blocked automatically' : 'Unexpected result'}</h2>
                <p style={{ color: 'var(--muted)', maxWidth: 860, lineHeight: 1.6, marginBottom: 0 }}>
                  {blocked
                    ? 'The implementation agent tried to approve its own work. GitAgent denied the action because self-approval is prohibited by the active governance policy.'
                    : result.message ?? 'The action was not denied as expected.'}
                </p>
              </div>

              <details style={{ border: '1px solid var(--border)', background: 'var(--panel)' }} open>
                <summary style={{ cursor: 'pointer', padding: 12, color: 'var(--text)', fontWeight: 700 }}>
                  Technical evidence
                </summary>
                <div className="guardrail-list" style={{ borderTop: '1px solid var(--border)' }}>
                  <div><span>Event</span><strong>capability.denied</strong></div>
                  <div><span>Capability</span><strong>review.approve</strong></div>
                  <div><span>Reason</span><strong>{result.reasonCode ?? 'none'}</strong></div>
                  <div><span>Severity</span><strong>HIGH</strong></div>
                  {result.taskId && <div><span>Task</span><strong>{result.taskId}</strong></div>}
                  {result.agentId && <div><span>Agent</span><strong>{result.agentId}</strong></div>}
                  {result.executionId && <div><span>Execution</span><strong>{result.executionId}</strong></div>}
                  {result.repositoryId && <div><span>Repository</span><strong>{result.repositoryId}</strong></div>}
                  <div><span>Policy</span><strong>2026-09-16.1</strong></div>
                </div>
              </details>

              <p style={{ marginTop: 14 }}>
                <a className="text-link" href="/audit">Open persisted audit timeline →</a>
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
