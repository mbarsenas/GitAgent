# Database Model

PostgreSQL is the initial system of record for GitAgent control-plane metadata.

## Initial entities

- users
- organizations
- memberships
- repositories
- agents
- provider_connections
- tasks
- executions
- capability_grants
- policies
- approvals
- audit_events
- budgets
- secret_references
- pull_request_refs
- deployment_records

## Modeling principles

- Use stable UUID identifiers for platform entities.
- Preserve immutable execution and audit references.
- Store provider/model identifiers separately from provider-specific configuration.
- Do not store plaintext secrets in ordinary application tables.
- Maintain explicit organization/repository ownership boundaries.
- Use created/updated timestamps consistently.

## Audit data

Audit events are append-oriented. Updates should create new events rather than silently rewriting historical decisions.

## Migrations

Schema changes require versioned migrations committed with the code that depends on them. Destructive migrations require explicit review, backup/rollback planning, and production approval.