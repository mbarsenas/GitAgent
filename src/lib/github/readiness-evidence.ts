// Both event families are persisted by supported execution paths.
export const outcomeEventTypes = {
  completed: ['execution.completed', 'agent.execution.completed'],
  failed: ['execution.failed', 'agent.execution.failed'],
};

type ReviewEvidence = {
  actorId: string | null;
  taskId: string | null;
  executionId: string | null;
  payload: unknown;
  execution: { id: string; agentId: string; taskId: string } | null;
};

export function isExactIndependentApproval(event: ReviewEvidence): boolean {
  const payload = event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown> : {};
  const execution = event.execution;
  return !!execution && !!event.actorId &&
    event.executionId === execution.id &&
    event.taskId === execution.taskId &&
    payload.reviewGitHubApp === 'gitagent-review' &&
    typeof payload.pullRequestNumber === 'number' &&
    Number.isInteger(payload.pullRequestNumber) && payload.pullRequestNumber > 0 &&
    payload.reviewerAgentId === event.actorId &&
    payload.implementationAgentId === execution.agentId &&
    event.actorId !== execution.agentId;
}
