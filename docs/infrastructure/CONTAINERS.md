# Containers

Agent executions should run in disposable isolated containers or equivalent sandboxes.

## Baseline controls

- Non-root execution where practical.
- Read-only base image.
- Ephemeral writable workspace.
- CPU and memory limits.
- Execution timeout.
- Explicit network policy.
- No host Docker socket exposure.
- No implicit host filesystem mounts.
- Short-lived credentials only.
- Teardown after execution.

## Image strategy

Maintain a small set of hardened execution images for common stacks. Repository-specific tooling should be declared explicitly and validated before use.

## Persistence

Only approved artifacts, logs, audit events, and Git changes persist after execution. The runtime workspace is disposable.