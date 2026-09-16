# GitAgent Architecture

## Purpose

GitAgent is an AI-native Git development platform. Git hosting remains standards-compatible, while AI agents, tasks, permissions, budgets, execution environments, approvals, and audit events are first-class platform objects.

## High-level components

- Web application: Next.js/TypeScript UI and API surface.
- Application database: PostgreSQL for users, organizations, repositories, agents, tasks, policies, approvals, provider metadata, and audit events.
- Git service abstraction: adapter layer for Forgejo/Gitea-compatible Git hosting.
- Agent control plane: creates tasks, resolves context, authorizes capabilities, selects providers/models, tracks budgets, and records audit events.
- Execution plane: isolated containers/runners used by agents to inspect repositories, modify code, and execute approved commands.
- Model gateway: provider-neutral interface for OpenAI/Codex, Anthropic Claude, Google Gemini, and OpenAI-compatible endpoints.
- Policy/approval service: evaluates requested actions against repository, organization, agent, task, secret, network, and deployment policies.
- Audit service: append-oriented event stream for human and agent activity.

## Trust boundaries

1. Human user to GitAgent application.
2. GitAgent application to Git backend.
3. Control plane to isolated execution environment.
4. Execution environment to model provider.
5. Execution environment to external network resources.
6. Runtime to secret stores.
7. Agent-produced change to protected branch or production deployment.

Every boundary must use explicit authentication and authorization. Agent access is never inferred solely from the initiating human's privileges.

## Core entities

- User
- Organization
- Repository
- Agent
- AgentCredential / ProviderConnection
- Task
- Execution
- CapabilityGrant
- Policy
- Approval
- AuditEvent
- Branch / PullRequest references
- SecretReference
- Budget

## Design principles

- AI agents are distinct identities.
- Least privilege is the default.
- Model providers are replaceable.
- Git operations use standard protocols and established backends where practical.
- Agent executions are isolated and resource-limited.
- Sensitive operations can require human approval.
- Every material action is attributable and auditable.
- Documentation changes accompany architectural or workflow changes.
