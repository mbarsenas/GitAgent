# Deployment

## Initial deployment topology

- Next.js application service.
- PostgreSQL database.
- Git backend service (Forgejo/Gitea-compatible).
- Agent control-plane service.
- Isolated agent worker pool.
- Artifact/audit storage.
- Reverse proxy/TLS termination.

## Environments

At minimum maintain local development, staging, and production environments. Production credentials, deployment permissions, and data are isolated from development.

## Deployment rules

- Build immutable artifacts from an approved commit.
- Run database migration checks before promotion.
- Validate staging before production.
- Require configured approval for production.
- Record commit SHA, artifact digest, actor/agent, approval, deployment result, and rollback reference.
- Avoid in-place manual production edits.

## Rollback

Every production release must have a documented rollback strategy for application code and database migrations.