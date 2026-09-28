# Agent Permissions

GitAgent uses capability-based authorization for agents.

## Example capabilities

- `repository.read`
- `repository.write`
- `repository.fetch`
- `repository.push` (task branch only; no force-push or protected-branch push)
- `branch.create`
- `branch.delete`
- `commit.create`
- `issue.read`
- `issue.write`
- `pr.read`
- `pr.create`
- `pr.review`
- `pr.merge` (builder only with task/human authorization, independent approval of the exact head commit, passing required checks, and branch-protection compliance)
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

Read-only repository access is the safest default. The builder's repository push grant is limited to its dedicated task branch. Merge, secret access, external network access, and production deployment require explicit grants. Builder merges additionally require independent approval of the exact head commit, passing required checks, and compliance with branch protection. Code-write or merge access does not grant production deployment access.

## Audit

Every capability request and decision must record the principal, task, execution, policy inputs, decision, reason, and timestamp.