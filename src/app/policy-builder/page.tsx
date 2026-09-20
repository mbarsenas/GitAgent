'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';

type Option = { id: string; name?: string; owner?: string; email?: string; slug?: string };
type Bootstrap = { repositories: Option[]; agents: Option[]; users: Option[] };

type Draft = {
  summary: string;
  capabilities: Record<string, boolean>;
  approvals: Record<string, boolean>;
  hardBoundaries: Record<string, boolean>;
  instructions: string;
};

const labels: Record<string, string> = {
  repositoryRead: 'Read repository',
  branchCreate: 'Create governed branches',
  branchWrite: 'Edit assigned branches',
  testsExecute: 'Run tests',
  pullRequestCreate: 'Open pull requests',
  sensitiveTransitions: 'Sensitive transitions',
  workflowChanges: 'Workflow changes',
  dependencyChanges: 'Dependency changes',
  secretsRead: 'Read secrets',
  selfReview: 'Review own work',
  selfApprove: 'Approve own pull request',
  selfMerge: 'Merge own pull request',
};

export default function PolicyBuilderPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ repositories: [], agents: [], users: [] });
  const [reviewing, setReviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ policyVersion: string; repository: string } | null>(null);

  useEffect(() => {
    fetch('/api/tasks').then((r) => r.json()).then(setBootstrap).catch(() => setError('Could not load repositories and agents.'));
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(''); setDraft(null); setReviewing(false); setApplied(null);
    const description = String(new FormData(event.currentTarget).get('description') || '');
    try {
      const response = await fetch('/api/policy-builder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'Policy generation failed');
      setDraft(body.draft);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  async function applyPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setApplying(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/policy-builder/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryId: form.get('repositoryId'), agentId: form.get('agentId'), draft }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'Policy apply failed');
      setApplied({ policyVersion: body.policyVersion, repository: body.repository });
      setReviewing(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setApplying(false); }
  }

  return (
    <ControlPlaneShell active="/policy-builder" title="AI Policy Builder" subtitle="HUMAN REVIEW REQUIRED">
      <div className="section-head"><div><p className="kicker">GitAgent / Governance</p><h1>Describe the boundaries. GitAgent drafts the policy.</h1></div></div>
      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head"><div><span className="panel-label">AI POLICY BUILDER</span><h2>No policy syntax required</h2></div><span className="counter">PROPOSAL ONLY</span></div>
        <form onSubmit={generate} style={{ padding: 16, display: 'grid', gap: 14 }}>
          <p className="muted" style={{ margin: 0, maxWidth: 920, lineHeight: 1.6 }}>Explain what the coding agent should be able to do, what should require your approval, and what it must never do. GitAgent converts that into a reviewable constraint proposal. Hard governance boundaries cannot be weakened by the AI.</p>
          <textarea name="description" required rows={7} placeholder="Example: Let the agent read this repo, create branches, edit code, run tests and open PRs. Ask me before changing workflows or dependencies. Never let it access secrets, approve its own work, or merge its own PR." style={{ width: '100%' }} />
          <div><button className="solid-button" disabled={loading}>{loading ? 'Drafting policy…' : 'Generate policy proposal'}</button></div>
          {error ? <div className="notice error" style={{ margin: 0 }}>{error}</div> : null}
        </form>
      </section>

      {draft ? <section className="ops-grid">
        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">EFFECTIVE PROPOSAL</span><h2>What the agent can do</h2></div></div>
          <div className="guardrail-list">
            {Object.entries(draft.capabilities).map(([key, value]) => <div key={key}><span>{labels[key] || key}</span><strong style={{ color: value ? '#39ff14' : 'var(--danger)' }}>{value ? 'ALLOW' : 'DENY'}</strong></div>)}
            {Object.entries(draft.approvals).map(([key, value]) => <div key={key}><span>{labels[key] || key}</span><strong style={{ color: value ? 'var(--warn)' : 'var(--muted)' }}>{value ? 'REQUIRE APPROVAL' : 'STANDARD POLICY'}</strong></div>)}
            {Object.entries(draft.hardBoundaries).map(([key]) => <div key={key}><span>{labels[key] || key}</span><strong className="deny">DENY · HARD BOUNDARY</strong></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">PLAIN ENGLISH</span><h2>Policy summary</h2></div></div>
          <div style={{ padding: 16, lineHeight: 1.65, fontSize: 11 }}><p style={{ marginTop: 0 }}>{draft.summary}</p><div className="notice" style={{ margin: 0 }}>This is a proposal. It does not change GitAgent permissions until a reviewed apply workflow is implemented.</div></div>
        </article>
        <article className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head"><div><span className="panel-label">GENERATED INSTRUCTIONS</span><h2>GitAgent constraint instructions</h2></div></div>
          <pre style={{ margin: 0, padding: 16, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text)', fontSize: 11 }}>{draft.instructions}</pre>
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="ghost-button" type="button" onClick={() => { setDraft(null); setReviewing(false); }}>← Edit request</button>
            <button className="ghost-button" type="button" onClick={() => { setDraft(null); setReviewing(false); }}>Regenerate</button>
            <button className="solid-button" type="button" onClick={() => setReviewing(true)}>Review & Apply Policy →</button>
          </div>
        </article>

        {reviewing ? <article className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head"><div><span className="panel-label">FINAL HUMAN REVIEW</span><h2>Choose the target and explicitly apply this policy</h2></div><span className="counter" style={{ color: 'var(--warn)' }}>NOT APPLIED YET</span></div>
          <form onSubmit={applyPolicy} style={{ padding: 16, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <label><span className="label">Repository</span><select name="repositoryId" required style={{ width: '100%', marginTop: 6 }}>{bootstrap.repositories.map((r) => <option key={r.id} value={r.id}>{r.owner ? `${r.owner} / ` : ''}{r.name}</option>)}</select></label>
              <label><span className="label">Agent</span><select name="agentId" required style={{ width: '100%', marginTop: 6 }}>{bootstrap.agents.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.slug}</option>)}</select></label>
              <label><span className="label">Policy author</span><strong>{bootstrap.users[0]?.name ?? bootstrap.users[0]?.email ?? 'Authenticated user'}</strong></label>
            </div>
            <div className="notice" style={{ margin: 0 }}>Applying replaces this agent's current capability grants for the selected repository. GitAgent re-enforces immutable boundaries server-side and records a <strong>policy.applied</strong> audit event.</div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" required /><span>I reviewed the effective permissions, approval gates, hard boundaries, and generated instructions.</span></label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="ghost-button" type="button" onClick={() => setReviewing(false)}>Cancel</button><button className="solid-button" disabled={applying} type="submit">{applying ? 'Applying governed policy…' : 'Confirm & Apply Policy'}</button></div>
          </form>
        </article> : null}
        {applied ? <div className="notice success" style={{ gridColumn: '1 / -1', margin: 0 }}><strong>✓ Policy applied.</strong> {applied.policyVersion} is now active for {applied.repository}. The change was written to the audit timeline.</div> : null}
      </section> : null}
    </ControlPlaneShell>
  );
}
