'use client';

import { useState } from 'react';

type DemoResult = {
  ok: boolean;
  denied: boolean;
  reasonCode?: string;
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
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Governance Demo</p>
            <h1>Prove the policy boundary, not just the happy path.</h1>
            <p className="lede">This test deliberately asks an implementation agent to approve its own work. GitAgent should deny it and persist the denial to the audit timeline.</p>
          </div>
        </header>

        <section className="card architecture">
          <p className="eyebrow">Adversarial test</p>
          <h2>Implementation agent self-approval</h2>
          <p>Expected result: denied with reason code <code>policy.self_approval_denied</code>.</p>
          <button className="primary" onClick={runSelfApprovalTest} disabled={loading}>
            {loading ? 'Running…' : 'Run self-approval test'}
          </button>
          {result && (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <strong>{result.denied ? 'Denied as expected' : 'Unexpectedly allowed'}</strong>
              <p>Reason: {result.reasonCode ?? 'none'}</p>
              <p><a href="/audit">Open audit timeline</a></p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
