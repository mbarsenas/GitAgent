export type AgentRole = "IMPLEMENTATION" | "REVIEW" | "DEPLOYMENT";

export type Capability =
  | "repository.read"
  | "branch.create"
  | "branch.write"
  | "tests.execute"
  | "pr.create"
  | "pr.review"
  | "pr.approve"
  | "pr.merge"
  | "secrets.read"
  | "deploy.execute";

export interface CapabilityContext {
  agentId: string;
  role: AgentRole;
  capabilities: Capability[];
  implementationAgentId?: string;
  reviewAgentId?: string;
}

export interface CapabilityDecision {
  allowed: boolean;
  reason: string;
  auditEvent: string;
}

export function authorizeCapability(
  context: CapabilityContext,
  requested: Capability,
): CapabilityDecision {
  if (
    context.role === "IMPLEMENTATION" &&
    (requested === "pr.review" ||
      requested === "pr.approve" ||
      requested === "pr.merge")
  ) {
    return {
      allowed: false,
      reason: "Implementation agents cannot review, approve, or merge their own work.",
      auditEvent: "capability.denied.self_review_boundary",
    };
  }

  if (
    context.role === "REVIEW" &&
    (requested === "branch.write" || requested === "pr.merge")
  ) {
    return {
      allowed: false,
      reason: "Review agents are read/review scoped and cannot modify implementation branches or merge.",
      auditEvent: "capability.denied.review_isolation_boundary",
    };
  }

  if (!context.capabilities.includes(requested)) {
    return {
      allowed: false,
      reason: `Capability ${requested} is not present in the agent grant.`,
      auditEvent: "capability.denied.not_granted",
    };
  }

  return {
    allowed: true,
    reason: `Capability ${requested} is explicitly granted.`,
    auditEvent: "capability.allowed",
  };
}
