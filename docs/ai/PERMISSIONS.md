# Agent Permissions

GitAgent uses capability-based authorization for agents.

## Example capabilities

- `repository.read`
- `repository.write`
- `branch.create`
- `branch.delete`
- `commit.create`
- `issue.read`
- `issue.write`
- `pr.read`
- `pr.create`
- `pr.review`
- `pr.merge`
- `test.execute`
- `command.execute`
- `network.egress`
- `secret.read`
- `package.publish`
- `deploy.staging`
- `deploy.production`

## Effective permissions

Effective permissions are the intersection of:

1. Organization policy.
2. Repository policy.
3. Agent definition.
4. Task-specific grants.
5. Runtime/environment restrictions.

No lower layer may expand permissions granted by a higher layer.

## Defaults

Read-only repository access is the safest default. Write, merge, secret access, external network access, and production deployment should require explicit grants and may require human approval.

## Audit

Every capability request and decision must record the principal, task, execution, policy inputs, decision, reason, and timestamp.