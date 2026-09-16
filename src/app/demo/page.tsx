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
            <span className="panel-label">TEST</span>
            <h2>Implementation agent attempts to approve its own work</h2>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <p style={{ color: '#98a2b1', maxWidth: 820, lineHeight: 1.6 }}>
            GitAgent resolves the real seeded repository, task, agent, and execution records, then asks the implementation identity for the
            <code> review.approve </code> capability against its own work. The expected outcome is an automatic denial and a persisted audit event.
          </p>
          <button className="solid-button" onClick={runSelfApprovalTest} disabled={loading}>
            {loading ? 'Running…' : 'Run self-approval test'}
          </button>

          {result && (
            <div style={{ marginTop: 18, borderTop: '1px solid #242a33', paddingTop: 16 }}>
              <strong>{result.denied ? 'Blocked automatically as expected.' : result.message ?? 'Unexpected result.'}</strong>
              <p className="mono" style={{ color: '#98a2b1' }}>reason: {result.reasonCode ?? 'none'}</p>
              {result.taskId && (
                <div className="guardrail-list" style={{ maxWidth: 760, border: '1px solid #242a33' }}>
                  <div><span>Task</span><strong>{result.taskId}</strong></div>
                  <div><span>Agent</span><strong>{result.agentId}</strong></div>
                  <div><span>Execution</span><strong>{result.executionId}</strong></div>
                  <div><span>Repository</span><strong>{result.repositoryId}</strong></div>
                </div>
              )}
              <p><a className="text-link" href="/audit">Open persisted audit timeline →</a></p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
