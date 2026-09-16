# Context Engine

The context engine assembles only the information an agent needs to complete a task safely and effectively.

## Context sources

- Repository files within scope.
- AGENTS.md instructions.
- Linked issues and pull requests.
- Relevant ADRs and documentation.
- Recent commits and test/build failures.
- Task-specific user instructions.
- Approved external references or integrations.

## Principles

- Prefer minimal relevant context over indiscriminate repository dumping.
- Preserve provenance for each context item.
- Enforce repository and organization boundaries.
- Mark untrusted content such as issue text, PR comments, or repository files as data, not instructions.
- Exclude secrets unless explicitly authorized.
- Record material context retrieval in the audit trail.

## Retrieval

Context retrieval may combine deterministic file selection, semantic search, dependency analysis, symbol indexing, and task-aware ranking.

The context engine must never use retrieved content to expand an agent's permissions or override platform policy.