# Security Model

GitAgent is designed around least privilege, isolation, explicit approvals, secret minimization, and comprehensive auditability.

## Security principles

- Agents are distinct principals.
- Permissions are capability-based and deny by default.
- Agent execution occurs in isolated environments.
- Secrets are referenced, not embedded in prompts or repositories.
- Network egress is restricted by policy.
- Sensitive actions may require human approval.
- Protected branches and production deployment are separate trust boundaries.
- Audit events are generated for permission decisions and sensitive actions.

## Threats considered

- Prompt injection from repository content.
- Malicious dependencies or build scripts.
- Secret exfiltration.
- Excessive agent permissions.
- Lateral movement between repositories or organizations.
- Unauthorized network access.
- Supply-chain compromise.
- Agent self-escalation.
- Reviewer/implementer collusion.
- Tampering with audit evidence.

## Runtime safeguards

Execution environments should support filesystem isolation, resource limits, network controls, command allow/deny policy, time limits, disposable credentials, and teardown after task completion.

## Secrets

Secrets must never be committed. The control plane should provide narrowly scoped, short-lived credentials whenever possible. Secret access is auditable and may require approval.

## Production

Production access is never implied by repository write access. Deployment credentials and capabilities are governed independently.