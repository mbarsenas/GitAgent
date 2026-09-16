# Agent Trust Lifecycle

GitAgent trust is dynamic, scoped, and reversible. An agent is never permanently trusted merely because a human sponsored it once.

## Design principles

1. **Trust is task-scoped by default**
   - Sponsorship grants an agent permission to act for a bounded task, repository, branch, capability set, budget, and time window.
   - Repository-wide persistent trust is an explicit elevated policy, not the default.

2. **Trust decays**
   - Grants expire by time, task completion, budget exhaustion, inactivity, or policy-defined reputation decay.
   - Re-approval can be required for new tasks, new repositories, new capability classes, or sensitive operations.

3. **Trust can move both up and down**
   - Agents may be promoted, restricted, quarantined, or revoked based on observed behavior and review outcomes.

4. **Implementation and review identities are independent**
   - A coding agent cannot approve its own work.
   - Review agents operate under separate identities and permissions.

## Trust states

### Untrusted
Allowed to read public context and, where policy permits, interact with issues. Cannot create branches or pull requests.

### Sponsored
A human or policy authority has approved a bounded task. Sponsorship includes:
- repository
- task/issue
- expiration
- capability set
- budget
- execution environment
- network policy
- approval requirements

### Trusted for Task
The agent may execute the capabilities granted for the current task, such as creating a branch, modifying code, running tests, and opening a PR. This trust ends when the task ends or an invalidating event occurs.

### Restricted
The agent remains active, but with a narrower capability envelope. Typical restrictions include read-only mode, lower concurrency, lower budget, mandatory human approval, or loss of branch/PR/secret/tool capabilities.

Restricted is intentionally different from Quarantined: the agent can still perform bounded work.

### Quarantined
All mutating capabilities are denied. Existing execution is paused or terminated. Quarantine never self-clears.

A quarantined agent requires explicit Human/Policy Review before it may execute again.

### Revoked
The agent cannot execute within the affected scope until explicitly reinstated through a new approval decision.

## Typed evidence and rejection reasons

Trust policy must operate on typed evidence, not a flat rejection counter.

A rejection or review outcome should carry at least:
- evidence type
- reason code
- severity
- source actor (human, review agent, policy engine, test runner)
- repository/task scope
- timestamp
- policy version
- supporting artifact or finding reference

Example reason classes:
- `quality.style`
- `quality.missing_test`
- `quality.incorrect_behavior`
- `security.vulnerability`
- `policy.forbidden_capability_attempt`
- `policy.branch_protection_bypass`
- `provenance.missing_evidence`
- `provenance.inconsistent_evidence`
- `behavior.spam_or_duplicate_submission`
- `behavior.reviewer_evasion`
- `runtime.abnormal_cost_or_token_usage`

Policy evaluates type and severity together. Three minor style rejections must not be treated as equivalent to three security or policy violations.

## Promotion model

Promotion is evidence-based rather than automatic. Candidate evidence includes:
- successful task completion
- review-agent findings resolved
- test pass rate
- low rollback/revert rate
- no policy violations
- human approvals
- stable cost and token usage
- no abnormal retry, spam, or concurrency patterns

Promotion can widen capability scope, increase concurrency, raise budgets, or reduce approval friction, but should not automatically grant merge, secret, or production deployment rights.

## Demotion and quarantine triggers

Examples include:
- review agent reports critical or repeated findings
- failed tests or policy checks beyond configured thresholds
- repeated human override or rejection
- PRs repeatedly closed without acceptance
- unauthorized capability attempts
- abnormal command, network, token, or cost behavior
- duplicate or spammy change generation
- unsafe interaction behavior
- attempts to evade reviewer or branch protections
- provenance/evidence package missing or inconsistent

## Restricted recovery vs quarantine recovery

These paths are intentionally asymmetric.

### Restricted -> Trusted for Task
Restriction may clear automatically when a policy-defined rehabilitation condition is met, for example:
- N clean tasks completed under restricted scope
- no medium/high/critical findings during the rehabilitation window
- all required tests pass
- no human override, revert, or policy violation
- cost/rate behavior remains within limits

Automatic widening must remain bounded and auditable. It may restore the prior task-scoped capability set, but it must not grant a new sensitive capability such as merge, secrets, or production deployment.

### Quarantined -> Reinstated or Revoked
Quarantine never clears automatically in the MVP.

A human reviewer must decide one of:
- **Reinstate**: permit future execution under an explicitly defined capability set, usually narrower than or equal to the prior scope.
- **Revoke**: deny further execution in the affected scope.

Reinstatement is not the mathematical inverse of quarantine. The reviewer must record the rationale and conditions for reinstatement.

Minimum reinstatement decision record:
- reviewer identity
- triggering quarantine event(s)
- evidence reviewed
- decision rationale
- resulting capability scope
- expiration/review date
- any required monitoring or approval conditions

## Feedback loop

The review layer feeds the trust layer.

```text
Implementation Agent
      |
      v
Branch / PR / Evidence
      |
      v
Independent Review Agent
      |
      +--> typed findings + severity
      +--> policy violations
      +--> test quality
      +--> provenance quality
      +--> confidence / uncertainty
      |
      v
Trust Evaluator
      |
      +--> maintain trust
      +--> restrict capabilities
      +--> require human approval
      +--> quarantine
      +--> revoke
```

Human decisions also feed the trust evaluator. A human may override automated demotion, but that override must itself be recorded as an auditable event.

## Reputation signals

GitAgent should avoid a single opaque "trust score" in early versions. Store explicit signals first:
- tasks completed
- typed rejection reasons
- review findings by severity
- tests passed/failed
- policy violations
- human approvals/rejections
- reverts/rollbacks
- cost variance
- rate-limit violations
- suspicious or duplicate submissions

Policy can later derive a score or tier from these transparent signals.

## MVP rule model

The first trust engine is rule-based and explainable. Example defaults:

- critical review finding -> quarantine
- attempted forbidden capability -> quarantine
- branch-protection bypass attempt -> quarantine
- repeated high-severity rejection -> restrict or quarantine depending on policy
- 3 substantive quality rejections in 10 runs -> restrict
- minor/style-only rejections -> informational unless persistent beyond a separate threshold
- repeated failed policy checks -> require human approval or restrict
- clean restricted runs -> eligible for automatic return to Trusted for Task
- quarantined state -> human decision required; no automatic recovery

All thresholds are versioned policy, not hard-coded product truth.

## MVP scope

The MVP includes the full reversible lifecycle, not just the upward path:

- untrusted -> sponsored -> trusted-for-task
- trusted-for-task -> restricted
- trusted-for-task -> quarantined
- restricted -> trusted-for-task via bounded policy-based rehabilitation
- restricted -> quarantined if new severe evidence appears
- quarantined -> human review -> reinstated or revoked
- reinstated -> sponsored/trusted-for-task under explicit scope

The first implementation does not require an advanced learned reputation model. Rule-based transitions are sufficient provided the underlying typed evidence and audit events are captured from day one.

## Required audit events

At minimum:
- sponsorship.granted
- sponsorship.expired
- trust.promoted
- trust.restricted
- trust.quarantined
- trust.revoked
- trust.reinstated
- trust.rehabilitation_completed
- policy.violation
- review.finding
- human.override
- human.reinstatement_decision
- execution.terminated

Every event must identify the agent, task, repository, triggering evidence, policy version, and actor that caused the decision.
