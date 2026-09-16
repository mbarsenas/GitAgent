# Runners

GitAgent separates conventional CI runners from AI agent execution workers, even when they share lower-level container infrastructure.

## CI runners

CI runners execute deterministic workflows such as builds, tests, linting, packaging, and deployment automation.

## Agent workers

Agent workers execute bounded AI tasks under explicit agent identity, permissions, model/provider, budget, network, secret, and approval policies.

## Required controls

- Ephemeral workspaces.
- Resource limits.
- Timeouts.
- Network policy.
- Disposable credentials.
- Audit event emission.
- Workspace cleanup.
- Artifact capture according to policy.

A CI workflow token and an agent capability grant are separate authorization concepts.