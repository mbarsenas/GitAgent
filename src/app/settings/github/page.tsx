import { ControlPlaneShell } from '@/app/components/control-plane-shell';
import { prisma } from '@/lib/db/prisma';
import { getGitHubAppConfig, isGitHubAppConfigured } from '@/lib/github/config';
import { verifyGitHubInstallation } from '@/lib/github/auth';
import { RepositoryActions } from './repository-actions';

export const dynamic = 'force-dynamic';

const permissionRows = [
  ['Metadata', 'Read'],
  ['Contents', 'Read / write'],
  ['Pull requests', 'Read / write'],
  ['Issues', 'Read / write'],
  ['Checks / Actions', 'Read'],
];

const successStyle = {
  border: '1px solid #39ff14',
  background: 'rgba(57, 255, 20, 0.14)',
  color: '#39ff14',
  boxShadow: '0 0 12px rgba(57, 255, 20, 0.22)',
};

const failureStyle = {
  border: '1px solid #7a5156',
  background: 'rgba(140, 84, 91, 0.13)',
  color: '#e1b9bc',
};

export default async function GitHubConnectionPage() {
  const repositories = await prisma.repository.findMany({
    where: { provider: 'github' },
    orderBy: [{ owner: 'asc' }, { name: 'asc' }],
    take: 50,
  });

  const config = getGitHubAppConfig();
  const configured = isGitHubAppConfigured(config);
  const verification = configured ? await verifyGitHubInstallation() : null;
  const connected = verification?.ok === true;
  const discoveredRepositories = verification?.ok ? verification.repositories : [];
  const statusText = connected ? '✓ CONNECTED' : configured ? 'AUTH FAILED' : 'NOT CONNECTED';

  return (
    <ControlPlaneShell active="/settings/github" title="GitHub App connection" subtitle={statusText}>
      <div className="section-head">
        <div>
          <p className="kicker">Settings / Integrations</p>
          <h1>GitHub App connection</h1>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">CONNECTION</span>
            <h2>Connect GitAgent to GitHub</h2>
          </div>
          <span className="counter" style={connected ? successStyle : configured ? failureStyle : undefined}>{statusText}</span>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, color: 'var(--muted)', maxWidth: 920, lineHeight: 1.6 }}>
            GitAgent uses a GitHub App installation rather than a personal access token. The connection badge is based on a live installation-token exchange with GitHub.
          </p>

          <div className="guardrail-list panel">
            <div><span>App slug</span><strong>{config.appSlug}</strong></div>
            <div><span>Installation ID</span><strong>{config.installationId || 'Not configured'}</strong></div>
            <div><span>Credential model</span><strong>Short-lived installation tokens</strong></div>
            <div>
              <span>Repository access</span>
              <strong style={connected ? { color: '#39ff14', textShadow: '0 0 10px rgba(57, 255, 20, 0.25)' } : undefined}>
                {connected ? `✓ Verified (${discoveredRepositories.length} repositor${discoveredRepositories.length === 1 ? 'y' : 'ies'})` : 'Not verified'}
              </strong>
            </div>
          </div>

          {verification && !verification.ok && (
            <div style={{ ...failureStyle, padding: 12, fontSize: 11 }}>
              GitHub authentication failed: {verification.error}
            </div>
          )}

          {!connected && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="solid-button" href={`https://github.com/apps/${config.appSlug}/installations/new`} target="_blank" rel="noreferrer">
                Install / Update GitAgent on GitHub
              </a>
              <a className="ghost-button" href="https://github.com/settings/installations" target="_blank" rel="noreferrer">
                Manage GitHub App installations
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="ops-grid">
        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">PERMISSIONS</span><h2>Requested GitHub access</h2></div></div>
          <div className="guardrail-list">
            {permissionRows.map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><span className="panel-label">BOUNDARY</span><h2>How GitAgent constrains access</h2></div></div>
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.65 }}>
            <p><strong style={{ color: 'var(--text)' }}>Implementation identity:</strong> branch creation, assigned-branch writes, draft PR creation.</p>
            <p><strong style={{ color: 'var(--text)' }}>Review identity:</strong> read diff, comment, approve/deny under separate credentials.</p>
            <p><strong style={{ color: 'var(--text)' }}>Merge:</strong> denied to implementation agents by default.</p>
            <p><strong style={{ color: 'var(--text)' }}>Audit:</strong> every GitHub API operation is persisted with task, execution, agent, repository, policy version, and result.</p>
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div><span className="panel-label">GITHUB INSTALLATION</span><h2>Repositories returned by GitHub</h2></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {connected && config.installationId ? <RepositoryActions installationId={config.installationId} /> : null}
            <span className="counter" style={connected ? successStyle : undefined}>{discoveredRepositories.length}</span>
          </div>
        </div>
        {discoveredRepositories.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 11 }}>No repositories returned by the live GitHub App installation.</div>
        ) : (
          <div className="event-table">
            {discoveredRepositories.map((repo) => (
              <div className="event-row" key={repo.id} style={{ background: 'rgba(105, 151, 130, 0.08)' }}>
                <div className="event-summary">{repo.full_name}</div>
                <div className="event-evidence">
                  <span className="mono muted">github</span>
                  <span className="severity info">{repo.default_branch}</span>
                  <strong className="mono">{repo.id}</strong>
                  <span style={{ color: '#39ff14', textShadow: '0 0 10px rgba(57, 255, 20, 0.22)' }}>✓ {repo.private ? 'Private' : 'Public'} · live installation access</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div><span className="panel-label">DATABASE</span><h2>Repositories known to GitAgent</h2></div>
          <span className="counter">{repositories.length}</span>
        </div>
        {repositories.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 11 }}>No GitHub repositories have been imported into GitAgent yet.</div>
        ) : (
          <div className="event-table">
            {repositories.map((repo) => (
              <div className="event-row" key={repo.id}>
                <div className="event-summary">{repo.owner} / {repo.name}</div>
                <div className="event-evidence">
                  <span className="mono muted">{repo.provider}</span>
                  <span className="severity info">{repo.defaultBranch}</span>
                  <strong className="mono">{repo.externalId}</strong>
                  <span>Imported into GitAgent</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ControlPlaneShell>
  );
}
