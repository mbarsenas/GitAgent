import type { AuditSink, AuditActorType } from "./audit";
import { authorizeCapability, type AgentRole, type Capability } from "./capabilities";

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

function auditActorType(role: AgentRole): AuditActorType {
  switch (role) {
    case "IMPLEMENTATION":
      return "implementation-agent";
    case "REVIEW":
      return "review-agent";
    case "DEPLOYMENT":
      return "system";
  }
}

export async function enforceCapability(
  request: EnforcementRequest,
  audit: AuditSink,
): Promise<EnforcementDecision> {
  const selfApproval =
    request.capability === "pr.approve" &&
    request.targetOwnerAgentId !== undefined &&
    request.actorId === request.targetOwnerAgentId;

  const decision = selfApproval
    ? {
        allowed: false,
        auditEvent: "capability.denied.self_review_boundary",
      }
    : authorizeCapability(
        {
          agentId: request.actorId,
          role: request.role,
          capabilities: [request.capability],
        },
        request.capability,
      );

  if (decision.allowed) {
    await audit.write({
      eventType: "capability.allowed",
      actorType: auditActorType(request.role),
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

  const reasonCode = selfApproval
    ? "policy.self_approval_denied"
    : decision.auditEvent === "capability.denied.review_isolation_boundary"
      ? "policy.review_isolation_boundary"
      : decision.auditEvent === "capability.denied.self_review_boundary"
        ? "policy.self_review_boundary"
        : "policy.capability_denied";

  await audit.write({
    eventType: "capability.denied",
    actorType: auditActorType(request.role),
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
