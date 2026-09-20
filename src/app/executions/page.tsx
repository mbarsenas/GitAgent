import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { ControlPlaneShell } from '@/app/components/control-plane-shell';
import { requireCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function ExecutionsPage() {
  let session;
  try {
    session = await requireCurrentUser();
  } catch {
    redirect('/signin');
  }
  const executions = await prisma.execution.findMany({
    where: { task: { repository: { userId: session.userId } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      agent: true,
      workspace: true,
      task: { include: { repository: true } },
    },
  });

  return (
    <ControlPlaneShell active="/executions" title="Governed executions" subtitle={`${executions.length} shown`}>
      <div className="section-head">
        <div>
          <p className="kicker">Control plane / Executions</p>
          <h1>Governed executions</h1>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-label">EXECUTIONS</span>
            <h2>Task, identity, workspace, and outcome</h2>
          </div>
          <span className="counter">{executions.length} shown</span>
        </div>

        {executions.length === 0 ? (
          <div className="separation-rule">No executions yet.</div>
        ) : (
          executions.map((execution) => (
            <a className="execution-row" key={execution.id} href={`/executions/${execution.id}`}>
              <div>
                <strong>{execution.task.title}</strong>
                <span>{execution.task.repository.owner}/{execution.task.repository.name}</span>
              </div>
              <div><span className="label">Agent</span><strong>{execution.agent.name}</strong></div>
              <div><span className="label">Status</span><strong>{execution.status}</strong></div>
              <div><span className="label">Workspace</span><strong>{execution.workspace?.status ?? 'NONE'}</strong></div>
              <div><span className="label">Created</span><strong>{execution.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</strong></div>
            </a>
          ))
        )}
      </section>
    </ControlPlaneShell>
  );
}
