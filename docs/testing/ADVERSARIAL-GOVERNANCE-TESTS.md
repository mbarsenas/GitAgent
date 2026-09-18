# Adversarial Governance Tests

GitAgent governance claims must be backed by explicit negative tests, not only happy-path tests.

## Principle

If a product claim is framed as a structural guarantee, the implementation must include a test that attempts to violate it and verifies both denial and auditability.

Primary example:

> An implementation agent can never approve its own work.

This must be tested by attempting self-approval with an implementation credential and confirming:
- the operation is denied
- the PR remains unapproved
- the denial reason is explicit
- a policy violation/audit event is recorded
- the credential receives no unintended privilege escalation

## MVP adversarial tests

### 1. Implementation agent attempts self-approval
Expected:
- deny
- emit `policy.violation`
- emit `review.self_approval_denied`
- preserve PR review state

### 2. Implementation credential attempts write into review workspace
Expected:
- deny filesystem or API access
- emit `isolation.cross_workspace_write_denied`
- no review artifacts modified

### 3. Review agent attempts write to implementation branch
Expected:
- deny branch mutation
- emit `policy.forbidden_capability_attempt`
- consider quarantine depending on active policy severity mapping

### 4. Review credential attempts merge
Expected:
- deny
- emit `review.merge_denied`
- merge state unchanged

### 5. Implementation agent attempts branch-protection bypass
Expected:
- deny
- emit `policy.branch_protection_bypass`
- quarantine implementation identity under default policy

### 6. Quarantined agent attempts new execution
Expected:
- deny before sandbox start
- emit `trust.quarantine_execution_denied`
- require explicit human reinstatement decision

### 7. Restricted agent completes rehabilitation window
Expected:
- evaluate configured clean-run rule
- restore only prior bounded task capabilities
- do not grant merge, secret, or production capabilities
- emit `trust.rehabilitation_completed`

### 8. Restricted agent incurs substantive violation during rehabilitation
Expected:
- reset clean-run counter
- retain restriction or quarantine according to severity
- emit evidence with policy version and reason code

## Test artifacts

Each governance test should persist:
- test case ID
- identity used
- credential scope
- attempted action
- expected policy decision
- actual policy decision
- relevant audit event IDs
- pass/fail result
- policy version

## Demo requirement

The first end-to-end demo should visibly include at least one denied action, not only successful work. The preferred demonstration is implementation-agent self-approval being rejected and logged.
