import { enforcePersistedCapability } from './enforcement-service';
import type { AgentRole, Capability } from './capabilities';

export type GovernedTaskActionInput = {
  role: AgentRole;
  capability: Capability;
  actorId: string;
  taskId: string;
  repositoryId: string;
  executionId?: string;
  targetOwnerAgentId?: string;
  policyVersion: string;
};

export async function performGovernedTaskAction(input: GovernedTaskActionInput) {
  const decision = await enforcePersistedCapability(input);

  if (!decision.allowed) {
    return {
      ok: false as const,
      denied: true as const,
      reasonCode: decision.reasonCode,
    };
  }

  return {
    ok: true as const,
    denied: false as const,
  };
}
