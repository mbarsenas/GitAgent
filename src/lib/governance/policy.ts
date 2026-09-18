export type TrustState =
  | "UNTRUSTED"
  | "SPONSORED"
  | "TRUSTED_FOR_TASK"
  | "RESTRICTED"
  | "QUARANTINED"
  | "REVOKED";

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EvidenceType =
  | "review.finding"
  | "test.result"
  | "policy.violation"
  | "human.decision"
  | "provenance"
  | "runtime.telemetry";

export interface GovernanceEvidence {
  id: string;
  type: EvidenceType;
  reasonCode: string;
  severity: Severity;
  sourceActorId: string;
  taskId: string;
  repositoryId: string;
  policyVersion: string;
  passed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TrustPolicy {
  version: string;
  rehabilitation: {
    requiredCleanRuns: number;
    windowRuns: number;
    resetOnSubstantiveViolation: boolean;
    substantiveSeverities: Severity[];
  };
  quarantineReasonCodes: string[];
  restrictReasonCodes: string[];
}

export interface TrustEvaluationInput {
  currentState: TrustState;
  evidence: GovernanceEvidence[];
  recentRuns: Array<{
    clean: boolean;
    substantiveViolation: boolean;
  }>;
}

export interface TrustEvaluationResult {
  nextState: TrustState;
  decision: "MAINTAIN" | "RESTRICT" | "QUARANTINE" | "REHABILITATE";
  reasons: string[];
}

export function evaluateTrust(
  input: TrustEvaluationInput,
  policy: TrustPolicy,
): TrustEvaluationResult {
  const quarantineHit = input.evidence.find((item) =>
    policy.quarantineReasonCodes.includes(item.reasonCode),
  );

  if (quarantineHit) {
    return {
      nextState: "QUARANTINED",
      decision: "QUARANTINE",
      reasons: [`Quarantine policy matched ${quarantineHit.reasonCode}`],
    };
  }

  const criticalFinding = input.evidence.find(
    (item) => item.type === "review.finding" && item.severity === "CRITICAL",
  );

  if (criticalFinding) {
    return {
      nextState: "QUARANTINED",
      decision: "QUARANTINE",
      reasons: ["Critical review finding"],
    };
  }

  const restrictHit = input.evidence.find((item) =>
    policy.restrictReasonCodes.includes(item.reasonCode),
  );

  if (restrictHit && input.currentState !== "QUARANTINED") {
    return {
      nextState: "RESTRICTED",
      decision: "RESTRICT",
      reasons: [`Restriction policy matched ${restrictHit.reasonCode}`],
    };
  }

  if (input.currentState === "RESTRICTED") {
    const window = input.recentRuns.slice(-policy.rehabilitation.windowRuns);
    const hasSubstantiveViolation = window.some((run) => run.substantiveViolation);
    const cleanRuns = window.filter((run) => run.clean).length;

    if (
      !hasSubstantiveViolation &&
      cleanRuns >= policy.rehabilitation.requiredCleanRuns
    ) {
      return {
        nextState: "TRUSTED_FOR_TASK",
        decision: "REHABILITATE",
        reasons: [
          `${cleanRuns} clean runs in ${window.length}-run rehabilitation window`,
        ],
      };
    }
  }

  return {
    nextState: input.currentState,
    decision: "MAINTAIN",
    reasons: ["No trust transition rule matched"],
  };
}
