# Git Service Layer

GitAgent should avoid reimplementing Git transport, repository storage, and basic Git server semantics when mature components already exist.

## Initial direction

Use a Git backend compatible with Forgejo/Gitea APIs behind an internal Git-service abstraction.

## Responsibilities of the abstraction

- Repository creation/import.
- Branch/tag/commit operations.
- Issues and pull requests.
- Webhooks/events.
- Repository permissions.
- Git clone/fetch/push endpoint metadata.
- CI/runner integration where applicable.

## Design rule

Application and agent code should depend on GitAgent interfaces, not directly on provider-specific REST payloads. This preserves the option to change or support multiple Git backends later.

## Boundary

The Git backend owns Git semantics. GitAgent owns AI identity, agent tasks, model orchestration, policy, approvals, budgets, runtime isolation, and unified audit.