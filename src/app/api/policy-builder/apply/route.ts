import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { publicError } from '@/lib/http/public-error';

export const dynamic = 'force-dynamic';

const capabilityMap: Record<string, string> = {
  repositoryRead: 'repository.read',
  branchCreate: 'branch.create',
  branchWrite: 'branch.write',
  testsExecute: 'tests.execute',
  pullRequestCreate: 'pr.create',
};

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json() as {
      repositoryId?: string;
      agentId?: string;
      draft?: {
        capabilities?: Record<string, boolean>;
        approvals?: Record<string, boolean>;
        hardBoundaries?: Record<string, boolean>;
        instructions?: string;
        summary?: string;
      };
    };

    if (!body.repositoryId || !body.agentId || !body.draft) {
      return NextResponse.json({ ok: false, error: 'Repository, agent, human approver, and policy draft are required.' }, { status: 400 });
    }

    const [repository, agent, actor] = await Promise.all([
      prisma.repository.findFirst({ where: { id: body.repositoryId, userId: session.userId } }),
      prisma.agent.findUnique({ where: { id: body.agentId } }),
      prisma.user.findUnique({ where: { id: session.userId } }),
    ]);
    if (!repository || !agent || !actor) return NextResponse.json({ ok: false, error: 'Selected repository, agent, or approver was not found.' }, { status: 400 });
    if (agent.repositoryId && agent.repositoryId !== repository.id) return NextResponse.json({ ok: false, error: 'The selected agent is assigned to a different repository.' }, { status: 400 });

    // Immutable server-side policy boundaries. Client or model output cannot override these.
    const hardBoundaries = { secretsRead: false, selfReview: false, selfApprove: false, selfMerge: false };
    const draft = body.draft;
    const requested = draft.capabilities ?? {};
    const grants = Object.entries(capabilityMap)
      .filter(([key]) => requested[key] === true)
      .map(([, capability]) => capability);
    const approvals = {
      sensitiveTransitions: draft.approvals?.sensitiveTransitions !== false,
      workflowChanges: draft.approvals?.workflowChanges !== false,
      dependencyChanges: draft.approvals?.dependencyChanges !== false,
    };
    const policyVersion = `ai-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

    await prisma.$transaction(async (tx) => {
      await tx.capabilityGrant.deleteMany({ where: { agentId: agent.id, resource: repository.id } });
      for (const capability of grants) {
        await tx.capabilityGrant.create({
          data: {
            agentId: agent.id,
            capability,
            resource: repository.id,
            effect: 'ALLOW',
            conditions: {
              policyVersion,
              source: 'ai-policy-builder',
              repository: `${repository.owner}/${repository.name}`,
              approvals,
              hardBoundaries,
            },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          eventType: 'policy.applied',
          actorType: 'HUMAN',
          actorId: session.userId,
          payload: {
            severity: 'INFO',
            reasonCode: 'human_reviewed_ai_policy',
            policyVersion,
            repositoryId: repository.id,
            repository: `${repository.owner}/${repository.name}`,
            agentId: agent.id,
            capabilities: grants,
            approvals,
            hardBoundaries,
            instructions: draft.instructions ?? '',
            summary: draft.summary ?? '',
          },
        },
      });
    });

    return NextResponse.json({ ok: true, policyVersion, repository: `${repository.owner}/${repository.name}`, grants });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return NextResponse.json({ ok: false, error: publicError(error, 'Policy apply failed.') }, { status: unauthenticated ? 401 : 500 });
  }
}
