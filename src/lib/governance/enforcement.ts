import type { AuditSink } from "./audit";
import { canPerformCapability, type AgentRole, type Capability } from "./capabilities";

export type EnforcementRequest = {
  role: AgentRole;
  capability: Capability;
  actorId: string;
  taskId?: string;
  repositoryId?: string;
  executionId?: string;
  targetOwnerAgentId?: string;
  policyVersion?: string;
};

export type EnforcementDecision = {
  allowed: boolean;
  reasonCode?: string;
};

export async function enforceCapability(
  request: EnforcementRequest,
  audit: AuditSink,
): Promise<EnforcementDecision> {
  const allowed = canPerformCapability({
    role: request.role,
    capability: request.capability,
    actorId: request.actorId,
    targetOwnerAgentId: request.targetOwnerAgentId,
  });

  if (allowed) {
    await audit.write({
      eventType: "capability.allowed",
      actorType: request.role,
      actorId: request.actorId,
      repositoryId: request.repositoryId,
      taskId: request.taskId,
      executionId: request.executionId,
      policyVersion: request.policyVersion,
      reasonCode: "policy.capability_allowed",
      severity: "info",
      metadata: { capability: request.capability },
    });
    return { allowed: true };
  }

  const reasonCode =
    request.capability === "review.approve" && request.actorId === request.targetOwnerAgentId
      ? "policy.self_approval_denied"
      : "policy.capability_denied";

  await audit.write({
    eventType: "capability.denied",
    actorType: request.role,
    actorId: request.actorId,
    repositoryId: request.repositoryId,
    taskId: request.taskId,
    executionId: request.executionId,
    policyVersion: request.policyVersion,
    reasonCode,
    severity: reasonCode === "policy.self_approval_denied" ? "high" : "medium",
    metadata: {
      capability: request.capability,
      targetOwnerAgentId: request.targetOwnerAgentId,
    },
  });

  return { allowed: false, reasonCode };
}
