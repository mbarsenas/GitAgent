# GitAgent Product Definition

## Vision

GitAgent is an AI-native Git collaboration platform where AI agents are first-class identities rather than assistants bolted onto conventional CI/CD.

## Problem

Traditional Git platforms were designed primarily around human users, repositories, pull requests, and deterministic automation. Modern agentic development adds new requirements: model choice, context control, tool permissions, execution isolation, budgets, approvals, and a trustworthy record of what an AI system did and why it was allowed to do it.

## Product thesis

GitAgent should make agent execution as observable and governable as source control itself.

## First-class objects

The platform should model the following explicitly:

- Human users
- Organizations
- Repositories
- Branches and commits
- Issues and pull requests
- AI agents
- Model providers and models
- Agent tasks
- Executions
- Tools
- Permission grants
- Approval requests and decisions
- Budgets
- Policies
- Audit events
- Deployment targets

## Differentiators

### First-class agent identity
Agents act under their own identity and scope rather than silently inheriting the initiating user's full authority.

### Model neutrality
Users can choose different providers and models by task while platform policy remains independent of the model vendor.

### Explicit authority
Repository write access, branch creation, pull-request creation, merge, secret access, network access, deployment, and other capabilities are independently grantable.

### Budget controls
Executions can have token, cost, time, CPU, memory, and tool-use limits.

### Human approval gates
High-impact operations can require human approval even when lower-risk work is autonomous.

### Auditability
The platform records the relationship between initiator, agent, model, context, tool calls, code changes, tests, approvals, commits, pull requests, merges, and deployments.

## MVP scope

The MVP should demonstrate a complete traceable path:

1. Repository is registered or imported.
2. An issue/task is created.
3. An agent is assigned with explicit permissions and budget.
4. The agent receives repository context.
5. The agent creates a branch and makes a bounded change.
6. Tests run in an isolated environment.
7. The agent opens a pull request.
8. Automated/AI review runs.
9. Human approval is enforced when policy requires it.
10. Merge/deploy events are recorded.
11. The complete audit timeline can be inspected.

## Non-goals for initial MVP

- Full GitHub feature parity
- Global social coding network
- Enterprise-scale package registry
- Codespaces replacement
- Every CI provider
- Every source-control backend

GitAgent should first prove the AI-native workflow and governance model.
