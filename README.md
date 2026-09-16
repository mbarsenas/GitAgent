# GitAgent

GitAgent is an AI-native Git collaboration platform designed around first-class AI agents, explicit permissions, auditable execution, model-neutral workflows, and human approval controls.

## Product principles

1. **Agents are identities** — every agent has its own ID, permissions, budgets, execution context, and audit trail.
2. **Humans remain accountable** — agent actions are always attributable to a human initiator or explicit automation policy.
3. **Least privilege by default** — repository, secret, network, merge, and deployment access are explicitly scoped.
4. **Model neutral** — OpenAI/Codex, Anthropic Claude, Google Gemini, local models, and OpenAI-compatible endpoints can be supported through provider abstractions.
5. **Workflow is documented and auditable** — issues, tasks, branches, executions, pull requests, reviews, approvals, merges, deploys, and audit events form one traceable chain.
6. **Git compatibility matters** — conventional Git, pull requests, and CI/CD remain first-class alongside agent workflows.

## Core workflow

```text
Idea
  ↓
Issue
  ↓
Requirements / Acceptance Criteria
  ↓
Architecture Decision Record (when needed)
  ↓
Agent Task
  ↓
Branch
  ↓
AI Execution
  ├─ Read context
  ├─ Modify code
  ├─ Run tests
  └─ Update documentation
  ↓
Pull Request
  ↓
AI Review + Automated Validation
  ↓
Human Approval (where policy requires it)
  ↓
Merge
  ↓
Deploy
  ↓
Audit Record
  ↓
Changelog / Documentation Update
```

## Repository structure

- `AGENTS.md` — repository-level operating contract for AI agents.
- `docs/PRODUCT.md` — product scope and principles.
- `docs/ROADMAP.md` — staged MVP roadmap.
- `docs/ARCHITECTURE.md` — system architecture.
- `docs/ai/` — AI-agent architecture, permissions, approvals, budgets, context, providers, and audit model.
- `docs/workflows/` — development and operational workflows.
- `docs/infrastructure/` — Git service, runners, containers, storage, and networking.
- `docs/adr/` — architecture decision records.

## Initial MVP direction

The MVP is intended to combine a Git hosting backend such as Forgejo/Gitea with an AI-native application layer that treats agents, tasks, approvals, policies, budgets, and audit events as first-class platform objects.

The initial application stack is expected to use Next.js/TypeScript, PostgreSQL, containerized local development, a Git-service abstraction, and model-provider abstractions.

See the `docs/` directory for the source of truth.
