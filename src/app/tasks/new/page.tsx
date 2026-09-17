'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';

type Option = { id: string; name?: string; slug?: string; email?: string; owner?: string };
type TaskBootstrap = { repositories: Option[]; agents: Option[]; users: Option[] };
type AgentRunResult = {
  status?: string;
  blocked?: boolean;
  reasonCode?: string;
  inspectedFiles?: string[];
  branch?: string;
};
type CreateTaskResult = {
  taskId: string;
  executionId: string;
  run?: AgentRunResult;
};

export default function NewTaskPage() {
  const [bootstrap, setBootstrap] = useState<TaskBootstrap>({ repositories: [], agents: [], users: [] });
  const [result, setResult] = useState<CreateTaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load task options');
        setBootstrap(await response.json());
      })
      .catch((error) => setError(error.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(event.currentTarget);
    const capabilities = ['repo.read', 'branch.create', 'branch.write', 'pr.create'];

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          goal: form.get('goal'),
          repositoryId: form.get('repositoryId'),
          agentId: form.get('agentId'),
          initiatorId: form.get('initiatorId'),
          maxCostUsd: Number(form.get('maxCostUsd') || 1),
          maxTokens: Number(form.get('maxTokens') || 20000),
          requiresHumanApproval: form.get('requiresHumanApproval') === 'on',
          capabilities,
          policyVersion: '2026-09-16.1',
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Task creation failed');

      const runResponse = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ executionId: body.executionId }),
      });
      const runBody = await runResponse.json();
      if (!runResponse.ok) throw new Error(runBody.error ?? 'Agent execution failed');

      setResult({
        taskId: body.taskId,
        executionId: body.executionId,
        run: runBody,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ControlPlaneShell active="/tasks/new" title="Start governed coding task" subtitle="repository agent">
      <div className="section-head">
        <div>
          <p className="kicker">GitAgent / New coding task</p>
          <h1>Tell GitAgent what to change</h1>
        </div>
      </div>

      <section className="panel" style={{ maxWidth: 980 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">CODING REQUEST</span>
            <h2>GitAgent will inspect the repository and start a governed execution</h2>
          </div>
        </div>

        <form onSubmit={submit} style={{ padding: 16, display: 'grid', gap: 16 }}>
          <label>
            <span className="label">Task title</span>
            <input name="title" required defaultValue="Fix repository issue" style={{ width: '100%', marginTop: 6 }} />
          </label>

          <label>
            <span className="label">What should GitAgent do?</span>
            <textarea
              name="goal"
              required
              rows={7}
              placeholder="Example: Fix the mobile navigation bug, run the tests, and open a pull request."
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <label>
              <span className="label">Repository</span>
              <select name="repositoryId" required style={{ width: '100%', marginTop: 6 }}>
                {bootstrap.repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.owner ? `${repo.owner} / ` : ''}{repo.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Implementation agent</span>
              <select name="agentId" required style={{ width: '100%', marginTop: 6 }}>
                {bootstrap.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name ?? agent.slug}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Human sponsor</span>
              <select name="initiatorId" required style={{ width: '100%', marginTop: 6 }}>
                {bootstrap.users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name ?? user.email}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span className="label">Maximum cost (USD)</span>
              <input name="maxCostUsd" type="number" min="0.01" step="0.01" defaultValue="1.00" style={{ width: '100%', marginTop: 6 }} />
            </label>
            <label>
              <span className="label">Maximum tokens</span>
              <input name="maxTokens" type="number" min="1000" step="1000" defaultValue="20000" style={{ width: '100%', marginTop: 6 }} />
            </label>
          </div>

          <div className="guardrail-list" style={{ border: '1px solid var(--border)' }}>
            <div><span>Read repository</span><strong>ALLOW</strong></div>
            <div><span>Create governed branch</span><strong>ALLOW</strong></div>
            <div><span>Edit assigned branch</span><strong>ALLOW</strong></div>
            <div><span>Open pull request</span><strong>ALLOW</strong></div>
            <div><span>Approve own pull request</span><strong className="deny">DENY</strong></div>
            <div><span>Merge pull request</span><strong className="deny">DENY</strong></div>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input name="requiresHumanApproval" type="checkbox" defaultChecked />
            <span>Require human approval for sensitive transitions</span>
          </label>

          <div>
            <button className="solid-button" disabled={loading} type="submit">
              {loading ? 'GitAgent is inspecting the repository…' : 'Start GitAgent'}
            </button>
          </div>

          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          {result && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gap: 8 }}>
              <strong>GitAgent execution started.</strong>
              <p className="mono muted" style={{ margin: 0 }}>task: {result.taskId}</p>
              <p className="mono muted" style={{ margin: 0 }}>execution: {result.executionId}</p>
              {result.run?.inspectedFiles?.length ? (
                <p className="muted" style={{ margin: 0 }}>Inspected {result.run.inspectedFiles.length} repository files.</p>
              ) : null}
              {result.run?.blocked ? (
                <div className="notice error" style={{ margin: 0 }}>
                  Repository inspection completed, but code generation is blocked: {result.run.reasonCode}.
                </div>
              ) : null}
              <p style={{ margin: 0 }}><a className="text-link" href={`/executions/${result.executionId}`}>Open execution →</a></p>
            </div>
          )}
        </form>
      </section>
    </ControlPlaneShell>
  );
}
