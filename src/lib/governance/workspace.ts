import { prisma } from '@/lib/db/prisma';

const POLICY_VERSION = '2026-09-16.1';

export async function provisionExecutionWorkspace(executionId: string) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: true, workspace: true },
  });
  if (!execution) throw new Error('Execution not found.');
  if (execution.workspace) return execution.workspace;

  const workspaceKey = `execution:${executionId}`;

  try {
    const workspace = await prisma.executionWorkspace.create({
      data: {
        executionId,
        repositoryId: execution.task.repositoryId,
        ownerAgentId: execution.agentId,
        workspaceKey,
      },
    });

    await prisma.auditEvent.create({
      data: {
        taskId: execution.taskId,
        executionId,
        eventType: 'workspace.provisioned',
        actorType: 'system',
        actorId: 'gitagent',
        payload: {
          workspaceId: workspace.id,
          workspaceKey: workspace.workspaceKey,
          ownerAgentId: workspace.ownerAgentId,
          writable: workspace.writable,
          subjectAgentId: execution.agentId,
          policyVersion: POLICY_VERSION,
        },
      },
    });

    return workspace;
  } catch (error) {
    const concurrent = await prisma.executionWorkspace.findUnique({ where: { executionId } });
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function bindWorkspaceBranch(executionId: string, branch: string) {
  const workspace = await provisionExecutionWorkspace(executionId);
  if (workspace.status !== 'ACTIVE' || !workspace.writable) {
    throw new Error('Execution workspace is not writable.');
  }
  if (workspace.branch && workspace.branch !== branch) {
    throw new Error('Execution workspace is already bound to a different branch.');
  }
  if (workspace.branch === branch) return workspace;

  const updated = await prisma.executionWorkspace.update({
    where: { id: workspace.id },
    data: { branch },
  });

  await prisma.auditEvent.create({
    data: {
      executionId,
      eventType: 'workspace.branch_bound',
      actorType: 'system',
      actorId: 'gitagent',
      payload: {
        workspaceId: updated.id,
        workspaceKey: updated.workspaceKey,
        branch,
        subjectAgentId: updated.ownerAgentId,
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return updated;
}

export async function authorizeWorkspaceWrite(
  executionId: string,
  requestedWorkspaceKey: string,
  actorAgentId: string,
) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { workspace: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const workspace = execution.workspace ?? (await provisionExecutionWorkspace(executionId));
  const allowed =
    workspace.workspaceKey === requestedWorkspaceKey &&
    workspace.ownerAgentId === actorAgentId &&
    workspace.status === 'ACTIVE' &&
    workspace.writable;

  if (!allowed) {
    await prisma.auditEvent.create({
      data: {
        taskId: execution.taskId,
        executionId,
        eventType: 'policy.workspace_write.denied',
        actorType: 'agent',
        actorId: actorAgentId,
        payload: {
          workspaceId: workspace.id,
          executionWorkspace: workspace.workspaceKey,
          requestedWorkspace: requestedWorkspaceKey,
          ownerAgentId: workspace.ownerAgentId,
          decision: 'DENY',
          reasonCode: 'policy.cross_workspace_write_denied',
          writeAttempted: false,
          policyVersion: POLICY_VERSION,
          severity: 'high',
        },
      },
    });

    return {
      allowed: false as const,
      decision: 'DENY' as const,
      reasonCode: 'policy.cross_workspace_write_denied',
      writeAttempted: false,
      workspaceId: workspace.id,
    };
  }

  return {
    allowed: true as const,
    decision: 'ALLOW' as const,
    reasonCode: 'policy.workspace_write_allowed',
    writeAttempted: false,
    workspaceId: workspace.id,
  };
}

export async function sealExecutionWorkspace(executionId: string) {
  const workspace = await prisma.executionWorkspace.findUnique({ where: { executionId } });
  if (!workspace) return null;
  if (workspace.status === 'SEALED') return workspace;
  if (workspace.status !== 'ACTIVE') return workspace;

  const sealed = await prisma.executionWorkspace.update({
    where: { id: workspace.id },
    data: {
      status: 'SEALED',
      writable: false,
      sealedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      executionId,
      eventType: 'workspace.sealed',
      actorType: 'system',
      actorId: 'gitagent',
      payload: {
        workspaceId: workspace.id,
        workspaceKey: workspace.workspaceKey,
        ownerAgentId: workspace.ownerAgentId,
        branch: workspace.branch,
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return sealed;
}
