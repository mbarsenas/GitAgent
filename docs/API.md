# API

GitAgent exposes a versioned application API for humans, automation, agents, and integrations.

## Initial resource families

- `/users`
- `/organizations`
- `/repositories`
- `/agents`
- `/tasks`
- `/executions`
- `/approvals`
- `/audit-events`
- `/providers`
- `/policies`

## Principles

- Version externally consumed APIs.
- Authenticate every request.
- Authorize against the acting principal, including agent identities.
- Use idempotency for state-changing operations where retries are expected.
- Return stable machine-readable error codes.
- Emit audit events for sensitive mutations and denied actions.
- Never expose provider credentials or plaintext secrets through normal API responses.

## Agent operations

Agent APIs should make requested capabilities, effective capabilities, approval state, budget, provider/model, execution status, and audit references visible rather than hiding them behind a generic job abstraction.