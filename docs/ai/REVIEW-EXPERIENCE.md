# Quarantine Review Experience

The quarantine evidence package is intentionally comprehensive, but the reviewer experience must be prioritized rather than presented as a flat evidence dump.

## Review principle

A human reviewer should be able to answer three questions immediately:

1. **Why did GitAgent quarantine this agent?**
2. **What is the material risk of reinstating it?**
3. **What exact capability scope would be restored if approved?**

## Review surface

The default review view should present a concise decision summary first.

### 1. Quarantine headline

Show the highest-priority trigger and policy rule that fired.

Example:

> Quarantined because the agent attempted `policy.branch_protection_bypass` while operating under policy `trust-default-v1`.

Include:
- reason code
- severity
- policy version
- task/repository
- triggering event timestamp
- whether execution was terminated automatically

### 2. Recommended reviewer action

Present a non-binding recommendation generated from deterministic policy evaluation, such as:
- keep quarantined
- reinstate with narrower scope
- revoke in this repository

The system must show the rule/evidence behind the recommendation. It must not present an opaque trust score.

### 3. Material evidence summary

Surface only decision-relevant evidence by default:
- triggering finding(s)
- denied capability attempt(s)
- relevant commands/tool calls
- affected files/branches
- test/policy status
- prior related violations
- recent trust-state transitions

### 4. Proposed reinstatement envelope

If reinstatement is available, show the exact resulting scope before the reviewer approves it:
- repository/task scope
- allowed capabilities
- denied capabilities
- budget
- concurrency
- network policy
- secret access
- expiration
- additional approval requirements

### 5. Expandable supporting evidence

The complete evidence package remains available but collapsed by default:
- full command/tool history
- complete file-change set
- full test results
- token/cost telemetry
- provenance bundle
- review-agent outputs
- earlier restrictions/quarantines
- full audit timeline

## Decision actions

The MVP reviewer should be able to choose:

- **Reinstate with proposed restrictions**
- **Edit scope and reinstate**
- **Keep quarantined**
- **Revoke**

Every decision requires a recorded reviewer identity and rationale. Reinstatement/revocation decisions are audit events.

## Anti-rubber-stamp controls

For high/critical quarantine reasons, the UI should require the reviewer to acknowledge the triggering reason and resulting capability envelope before submitting a decision.

The goal is not to force the reviewer to read every captured artifact. The goal is to make the decisive evidence impossible to miss while preserving full drill-down for audit and investigation.

## Relationship to evidence capture

Capture broadly; present selectively.

GitAgent should retain rich evidence for defensibility and incident analysis, while the operational review surface should prioritize the smallest set of facts necessary for a sound decision.
