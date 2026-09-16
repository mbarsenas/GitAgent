# Incident Response

## Objectives

Contain impact, preserve evidence, restore service safely, and capture lessons without allowing incident pressure to bypass authorization controls.

## Workflow

1. Detect and classify the incident.
2. Open an incident record with affected repositories, services, tenants, credentials, and agents.
3. Restrict or revoke risky agent capabilities where appropriate.
4. Preserve audit events, logs, execution artifacts, commits, and deployment metadata.
5. Contain the issue using approved emergency procedures.
6. Remediate and validate in an isolated or staging environment.
7. Require appropriate approval before production recovery actions.
8. Restore service and monitor for recurrence.
9. Complete root-cause analysis.
10. Add follow-up issues, tests, controls, and ADR changes as needed.

Emergency access must be auditable and time-bounded. It must not become a permanent privilege escalation path.