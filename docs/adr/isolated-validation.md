# Isolated repository validation

## Decision

GitAgent downloads a bounded repository snapshot with its GitHub installation token in the control plane, then transfers only file contents to a fresh Vercel Sandbox. The token and application environment are never passed to the sandbox. Node dependencies install with lifecycle scripts disabled while egress is limited to the npm registry. Before any repository script runs, the sandbox network policy changes to `deny-all`. The sandbox is stopped after validation, including failed runs.

Documentation-only changes do not execute code. A snapshot over 25 MB, a truncated Git tree, an unsafe path, or a sandbox setup failure fails validation closed. The agent finalizes a failed execution and seals its workspace on errors after execution starts.

## Consequences

Code validation now depends on Vercel Sandbox availability and its Vercel OIDC authentication in deployed environments. npm packages hosted outside the allowed registry may fail installation. Long-running commands remain bounded by the command and sandbox timeouts. A separate production code-change smoke test is required before broad repository use.
