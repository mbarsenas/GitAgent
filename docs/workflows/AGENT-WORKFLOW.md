# Agent Workflow

1. A human, automation, or system event creates a task.
2. GitAgent resolves repository policy, AGENTS.md instructions, issue context, and applicable ADRs.
3. An agent identity and model/provider are selected.
4. Effective permissions and budgets are computed.
5. Required approvals are requested before sensitive access is granted.
6. An isolated execution environment is provisioned.
7. The agent reads only the context and resources within scope.
8. The agent performs approved actions and emits audit events.
9. Tests and validation are executed.
10. If write access is allowed, the agent creates changes on a dedicated branch.
11. If PR creation is allowed, the agent opens a PR linked to the task/issue.
12. A separate reviewer agent and/or human reviews the result.
13. Merge or deployment occurs only after configured approvals and checks pass.
14. The execution closes with final status, cost/usage data, artifacts, and audit references.

Agents must never silently expand their own permissions, budget, secret access, network access, or deployment scope.