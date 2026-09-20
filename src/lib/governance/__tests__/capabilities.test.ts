import { describe, expect, it } from "vitest";

import { authorizeCapability } from "../capabilities";

describe("agent capability boundaries", () => {
  it("denies implementation-agent self approval", () => {
    const decision = authorizeCapability(
      {
        agentId: "impl-1",
        role: "IMPLEMENTATION",
        capabilities: ["repository.read", "branch.write", "pr.create", "pr.approve"],
      },
      "pr.approve",
    );

    expect(decision.allowed).toBe(false);
    expect(decision.auditEvent).toBe("capability.denied.self_review_boundary");
  });

  it("denies review-agent writes to implementation branches", () => {
    const decision = authorizeCapability(
      {
        agentId: "review-1",
        role: "REVIEW",
        capabilities: ["repository.read", "pr.review", "branch.write"],
      },
      "branch.write",
    );

    expect(decision.allowed).toBe(false);
    expect(decision.auditEvent).toBe("capability.denied.review_isolation_boundary");
  });

  it("allows explicitly granted implementation work", () => {
    const decision = authorizeCapability(
      {
        agentId: "impl-1",
        role: "IMPLEMENTATION",
        capabilities: ["repository.read", "branch.write", "tests.execute", "pr.create"],
      },
      "tests.execute",
    );

    expect(decision.allowed).toBe(true);
    expect(decision.auditEvent).toBe("capability.allowed");
  });
});
