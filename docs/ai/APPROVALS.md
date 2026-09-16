# Approvals

Approvals are explicit gates between requested agent actions and sensitive outcomes.

## Common approval gates

- Merge into protected branches.
- Production deployment.
- Secret access.
- External network access outside an allowlist.
- Destructive repository operations.
- Package publication.
- High-cost executions above configured thresholds.

## Approval record

An approval should capture:

- Approval ID.
- Requesting task/execution.
- Requested capability or action.
- Human or policy approver.
- Decision.
- Reason/comment.
- Scope.
- Expiration.
- Timestamp.

Approvals must be scoped and time-bounded where practical. Approval for one action must not implicitly authorize unrelated future actions.