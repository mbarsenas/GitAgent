import { describe, expect, it } from "vitest";
import { InMemoryAuditSink } from "../audit";
import { enforceCapability } from "../enforcement";

describe("governance enforcement audit", () => {
  it("denies implementation-agent self approval and records an audit event", async () => {
    const audit = new InMemoryAuditSink();

    const decision = await enforceCapability(
      {
        role: "implementation-agent",
        capability: "review.approve",
        actorId: "agent-impl-1",
        targetOwnerAgentId: "agent-impl-1",
        taskId: "task-1",
        repositoryId: "repo-1",
        executionId: "exec-1",
        policyVersion: "2026-09-16.1",
      },
      audit,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("policy.self_approval_denied");

    const events = audit.list();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("capability.denied");
    expect(events[0].reasonCode).toBe("policy.self_approval_denied");
    expect(events[0].severity).toBe("high");
    expect(events[0].metadata).toMatchObject({ capability: "review.approve" });
  });

  it("records successful capability checks as auditable events", async () => {
    const audit = new InMemoryAuditSink();

    const decision = await enforceCapability(
      {
        role: "review-agent",
        capability: "review.approve",
        actorId: "agent-review-1",
        targetOwnerAgentId: "agent-impl-1",
        taskId: "task-1",
      },
      audit,
    );

    expect(decision.allowed).toBe(true);
    expect(audit.list()[0].eventType).toBe("capability.allowed");
  });
});
