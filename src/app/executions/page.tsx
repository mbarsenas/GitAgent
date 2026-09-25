import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';
import { requireCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

type FilterKey = 'completed' | 'all' | 'failed' | 'running';

const filterOptions: Array<{ key: FilterKey; label: string }> = [
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Failed' },
  { key: 'running', label: 'Running' },
];

function normalizeFilter(value: string | string[] | undefined): FilterKey {
  const resolved = Array.isArray(value) ? value[0] : value;
  return filterOptions.some((option) => option.key === resolved) ? (resolved as FilterKey) : 'completed';
}

function executionMatchesFilter(status: string, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'completed') return status === 'SUCCEEDED';
  if (filter === 'failed') return status === 'FAILED';
  return status !== 'SUCCEEDED' && status !== 'FAILED';
}

export default async function ExecutionsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  let session;
  try {
    session = await requireCurrentUser();
  } catch {
    redirect('/signin');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = normalizeFilter(resolvedSearchParams.status);

  const executions = await prisma.execution.findMany({
    where: { task: { repository: { userId: session.userId } } },
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: {
      agent: true,
      workspace: true,
      task: { include: { repository: true } },
    },
  });

  const filteredExecutions = executions.filter((execution) => executionMatchesFilter(execution.status, activeFilter));

  return (
    <ControlPlaneShell active="/executions" title="Governed executions" subtitle={`${filteredExecutions.length} shown`}>
      <div className="section-head">
        <div>
          <p className="kicker">Control plane / Executions</p>
          <h1>Governed executions</h1>
        </div>
      </div>

      <section className="panel executions-panel">
        <div className="panel-head execution-panel-head">
          <div>
            <span className="panel-label">EXECUTIONS</span>
            <h2>Task, identity, workspace, and outcome</h2>
          </div>
          <div
            className="execution-panel-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <nav
              className="status-filter"
              aria-label="Execution status filter"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              {filterOptions.map((option) => {
                const isActive = activeFilter === option.key;

                return (
                  <a
                    key={option.key}
                    href={`/executions?status=${option.key}`}
                    className={isActive ? 'active' : ''}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '26px',
                      padding: '4px 8px',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'rgba(114, 237, 177, .12)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--muted)',
                      fontSize: '8px',
                      fontWeight: isActive ? 800 : 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {option.label}
                  </a>
                );
              })}
            </nav>
            <span className="counter">{filteredExecutions.length} shown</span>
          </div>
        </div>

        <div
          className="execution-table-head"
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(150px, 1fr) minmax(88px, .55fr) minmax(90px, .6fr) minmax(150px, .8fr)',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-soft)',
            color: 'var(--muted)',
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
          }}
        >
          <span>Task</span>
          <span>Agent</span>
          <span>Status</span>
          <span>Workspace</span>
          <span>Created</span>
        </div>

        {filteredExecutions.length === 0 ? (
          <div className="separation-rule">No {activeFilter === 'all' ? '' : `${activeFilter} `}executions found.</div>
        ) : (
          filteredExecutions.map((execution) => (
            <a className="execution-row" key={execution.id} href={`/executions/${execution.id}`}>
              <div>
                <strong>{execution.task.title}</strong>
                <span>{execution.task.repository.owner}/{execution.task.repository.name}</span>
              </div>
              <div><strong>{execution.agent.name}</strong></div>
              <div><strong className={`execution-status status-${execution.status.toLowerCase()}`}>{execution.status}</strong></div>
              <div><strong>{execution.workspace?.status ?? 'NONE'}</strong></div>
              <div><strong>{execution.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</strong></div>
            </a>
          ))
        )}
      </section>
    </ControlPlaneShell>
  );
}
