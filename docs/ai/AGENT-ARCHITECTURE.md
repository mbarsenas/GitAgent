# Agent Architecture

## Objective

Agents are first-class principals in GitAgent. They are not aliases for humans and do not automatically inherit a user's repository privileges.

## Agent definition

An agent includes:

- Stable agent identity.
- Display name and purpose.
- Allowed provider/model set.
- Default capabilities.
- Repository and organization scope.
- Secret access policy.
- Network access policy.
- Resource limits.
- Token and monetary budgets.
- Approval requirements.
- Audit policy.

## Execution model

A task creates one or more executions. Each execution receives an immutable execution context containing:

- Human initiator.
- Agent identity.
- Repository and target ref.
- Task objective.
- Approved capabilities.
- Provider/model.
- Context bundle.
- Environment policy.
- Budget.
- Approval state.

The execution runs in an isolated workspace. It may read repository content, invoke tools, change files, run commands, and create Git artifacts only when the corresponding capabilities are granted.

## Separation of duties

GitAgent should support separate agent roles such as developer, reviewer, security reviewer, documentation agent, test agent, release agent, and incident agent. A developer agent should not automatically be permitted to approve or merge its own changes.

## Failure behavior

Executions fail closed when required policy, identity, context, approval, budget, or secret information is missing or invalid. Failed and denied actions still emit audit events.