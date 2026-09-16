import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const permissionRows = [
  ['Metadata', 'Read'],
  ['Contents', 'Read / write'],
  ['Pull requests', 'Read / write'],
  ['Issues', 'Read / write'],
  ['Checks / Actions', 'Read'],
];

export default async function GitHubConnectionPage() {
  const repositories = await prisma.repository.findMany({
    where: { provider: 'github' },
    orderBy: [{ owner: 'asc' }, { name: 'asc' }],
    take: 50,
  });

  const installationId = process.env.GITHUB_APP_INSTALLATION_ID ?? '';
  const appSlug = process.env.GITHUB_APP_SLUG ?? 'gitagent-control';
  const connected = Boolean(installationId);

  return (
    <main className="main-panel">
      <div className="section-head">
        <div>
          <p className="kicker">Settings / Integrations</p>
          <h1>GitHub App connection</h1>
        </div>
        <a className="ghost-button" href="/">Back to control plane</a>
      </div>

      <section className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">CONNECTION</span>
            <h2>Connect GitAgent to GitHub</h2>
          </div>
          <span className="counter">{connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, color: '#98a2b1', maxWidth: 920, lineHeight: 1.6 }}>
            GitAgent uses a GitHub App installation rather than a personal access token. The installation controls which repositories GitAgent can see, while task-scoped policy controls what each agent may do inside those repositories.
          </p>

          <div className="guardrail-list" style={{ border: '1px solid #242a33' }}>
            <div><span>App slug</span><strong>{appSlug}</strong></div>
            <div><span>Installation ID</span><strong>{installationId || 'Not configured'}</strong></div>
            <div><span>Credential model</span><strong>Short-lived installation tokens</strong></div>
            <div><span>Repository access</span><strong>Installation-scoped</strong></div>
          </div>

          {!connected && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="solid-button" href={`https://github.com/apps/${appSlug}/installations/new`} target="_blank" rel="noreferrer">
                Install GitAgent on GitHub
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
          <div className="panel-head">
            <div>
              <span className="panel-label">PERMISSIONS</span>
              <h2>Requested GitHub access</h2>
            </div>
          </div>
          <div className="guardrail-list">
            {permissionRows.map(([name, value]) => (
              <div key={name}><span>{name}</span><strong>{value}</strong></div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="panel-label">BOUNDARY</span>
              <h2>How GitAgent constrains access</h2>
            </div>
          </div>
          <div style={{ padding: 16, color: '#98a2b1', fontSize: 12, lineHeight: 1.65 }}>
            <p><strong style={{ color: '#e7eaf0' }}>Implementation identity:</strong> branch creation, assigned-branch writes, draft PR creation.</p>
            <p><strong style={{ color: '#e7eaf0' }}>Review identity:</strong> read diff, comment, approve/deny under separate credentials.</p>
            <p><strong style={{ color: '#e7eaf0' }}>Merge:</strong> denied to implementation agents by default.</p>
            <p><strong style={{ color: '#e7eaf0' }}>Audit:</strong> every GitHub API operation is persisted with task, execution, agent, repository, policy version, and result.</p>
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div>
            <span className="panel-label">REPOSITORIES</span>
            <h2>Repositories known to GitAgent</h2>
          </div>
          <span className="counter">{repositories.length}</span>
        </div>
        {repositories.length === 0 ? (
          <div style={{ padding: 16, color: '#7f8997', fontSize: 11 }}>
            No GitHub repositories have been imported into GitAgent yet.
          </div>
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
    </main>
  );
}
