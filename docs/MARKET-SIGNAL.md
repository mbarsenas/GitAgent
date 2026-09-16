# Market Signal: AI-Native Git Governance

## Why this matters

GitAgent is being built during a rapid increase in AI-assisted and agentic software-development activity. GitHub has publicly acknowledged that traffic is growing rapidly, driven in large part by AI-assisted and agentic development workflows, and that it is reworking infrastructure for greater resilience.

Maintainers are also receiving more controls to manage contribution volume, including the ability to disable pull requests, restrict pull request creation to collaborators, restrict issue creation to collaborators, and apply interaction limits.

These developments reinforce the product hypothesis behind GitAgent: AI agents should not be treated as ordinary human contributors operating through the same coarse-grained trust model.

## Product opportunity

GitAgent should provide controls that preserve legitimate outside contribution while reducing agent-generated noise and review burden.

Core product responses should include:

- First-class agent identities rather than opaque bot or user impersonation.
- Repository-level trust policies for humans, agents, organizations, and external contributors.
- Agent provenance attached to every issue, task, branch, commit, pull request, review, and deployment.
- Capability-scoped permissions for actions such as reading code, creating branches, opening PRs, merging, accessing secrets, and deploying.
- Submission gates based on repository policy rather than only binary allow/deny controls.
- Required issue or task linkage before an agent can open a PR.
- Human-sponsorship requirements for untrusted agents.
- Rate and concurrency limits per agent identity, provider, repository, and organization.
- Cost, token, and execution-time budgets.
- Automated evidence packages showing what context the agent read, what tools it used, tests it ran, files it changed, and why it believes the change is correct.
- AI-assisted triage that can quarantine low-confidence, duplicate, spam-like, or policy-violating submissions without disabling legitimate contribution entirely.
- Independent review agents with separate identities and permission scopes from implementation agents.
- Reputation and trust history for agents based on accepted work, rejected work, policy violations, rollback frequency, and review outcomes.
- Kill switches, revocation, and containment when an agent behaves abusively or outside policy.
- Complete auditability for actions taken by humans and agents.

## Design principle

GitAgent should optimize for **selective trust**, not simply open versus closed contribution.

A repository owner should be able to express policy such as:

> External humans may propose issues. Untrusted agents may not open a pull request until an issue is approved. Trusted agents may create branches and PRs but may not merge. Security agents may read all code but cannot modify it. Deployment agents may deploy only after human approval.

This policy model should be more granular than simply disabling pull requests or restricting them to collaborators.

## Reliability implication

AI-native workflows also increase dependence on runners, orchestration systems, model providers, network services, and external APIs. GitAgent should therefore avoid a single control-plane dependency for all execution.

Architectural goals should include:

- provider-neutral model routing;
- resumable and idempotent agent tasks;
- queue-based execution;
- retry and backoff policies;
- per-provider health state;
- workload isolation;
- ability to route deterministic CI separately from agent execution;
- graceful degradation when an LLM provider or runner pool is unavailable;
- task-level evidence showing whether failure was caused by GitAgent, a Git backend, a model provider, a runner, or another dependency.

## Near-term roadmap impact

The following features should be treated as core MVP/post-MVP work rather than optional enhancements:

1. Agent identity and provenance.
2. Trust tiers and capability grants.
3. Issue-to-task-to-PR gating.
4. Agent rate limits and concurrency controls.
5. Human approval policies.
6. Submission evidence and confidence metadata.
7. Agent reputation and policy-violation history.
8. Quarantine/triage queues for external AI contributions.
9. Provider and runner health telemetry.
10. Kill switch and credential revocation.

## Validation notes

Some widely circulated statistics about AI-generated pull-request volume and GitHub incident counts come from third-party reporting or community discussion and should not be treated as canonical GitAgent requirements without verification. Product decisions should be grounded in the broader observable trend: agentic contribution volume is increasing rapidly, maintainers are requesting stronger controls, GitHub has shipped increasingly restrictive contribution-management settings, and AI-dependent workflows introduce new reliability and governance pressures.
