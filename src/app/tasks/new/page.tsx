'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';

type Option = { id: string; name?: string; slug?: string; email?: string; owner?: string };
type TaskBootstrap = { repositories: Option[]; agents: Option[]; users: Option[] };
type CreateTaskResult = { taskId: string; executionId: string };

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
    if (!response.ok) {
      setError(body.error ?? 'Task creation failed');
      setLoading(false);
      return;
    }

    setResult({ taskId: body.taskId, executionId: body.executionId });
    setLoading(false);
  }

  return (
    <ControlPlaneShell active="/tasks/new" title="Create agent task" subtitle="governed task">
      <div className="section-head">
        <div>
          <p className="kicker">Tasks / New governed task</p>
          <h1>Create agent task</h1>
        </div>
      </div>

      <section className="panel" style={{ maxWidth: 980 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">TASK DEFINITION</span>
            <h2>Bound the work before the agent starts</h2>
          </div>
        </div>

        <form onSubmit={submit} style={{ padding: 16, display: 'grid', gap: 16 }}>
          <label>
            <span className="label">Title</span>
            <input name="title" required defaultValue="Implement governed change" style={{ width: '100%', marginTop: 6 }} />
          </label>

          <label>
            <span className="label">Goal</span>
            <textarea
              name="goal"
              required
              rows={5}
              defaultValue="Make a bounded repository change and open a pull request under GitAgent policy."
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
            <div><span>Repository read</span><strong>ALLOW</strong></div>
            <div><span>Create branch</span><strong>ALLOW</strong></div>
            <div><span>Write assigned branch</span><strong>ALLOW</strong></div>
            <div><span>Create pull request</span><strong>ALLOW</strong></div>
            <div><span>Approve own pull request</span><strong className="deny">DENY</strong></div>
            <div><span>Merge pull request</span><strong className="deny">DENY</strong></div>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input name="requiresHumanApproval" type="checkbox" defaultChecked />
            <span>Require human approval for sensitive transitions</span>
          </label>

          <div>
            <button className="solid-button" disabled={loading} type="submit">
              {loading ? 'Creating…' : 'Create governed task'}
            </button>
          </div>

          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          {result && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <strong>Task created successfully.</strong>
              <p className="mono muted">task: {result.taskId}</p>
              <p className="mono muted">execution: {result.executionId}</p>
              <p><a className="text-link" href={`/executions/${result.executionId}`}>Open execution →</a></p>
            </div>
          )}
        </form>
      </section>
    </ControlPlaneShell>
  );
}
