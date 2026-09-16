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
The agent retains limited read or diagnostic capabilities but loses write, PR, secret, or execution permissions.

### Quarantined
All mutating capabilities are denied. Existing execution is paused or terminated. The agent may require human review before any future task.

### Revoked
The agent cannot execute within the affected scope until explicitly reinstated.

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
      +--> findings severity
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
- tasks rejected
- review findings by severity
- tests passed/failed
- policy violations
- human approvals/rejections
- reverts/rollbacks
- cost variance
- rate-limit violations
- suspicious or duplicate submissions

Policy can later derive a score or tier from these transparent signals.

## MVP scope

The MVP includes both the upward and downward paths:

- untrusted -> sponsored -> trusted-for-task
- trusted-for-task -> restricted
- trusted-for-task -> quarantined
- restricted/quarantined -> human review -> reinstated or revoked

The first implementation does not require an advanced learned reputation model. Rule-based demotion and quarantine are sufficient for MVP, provided the underlying evidence and audit events are captured from day one.

## Required audit events

At minimum:
- sponsorship.granted
- sponsorship.expired
- trust.promoted
- trust.restricted
- trust.quarantined
- trust.revoked
- trust.reinstated
- policy.violation
- review.finding
- human.override
- execution.terminated

Every event must identify the agent, task, repository, triggering evidence, policy version, and actor that caused the decision.
