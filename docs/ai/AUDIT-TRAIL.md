# Audit Trail

GitAgent records material human, agent, policy, and system actions as append-oriented audit events.

## Minimum event fields

- Event ID.
- Timestamp.
- Human initiator, when applicable.
- Agent ID.
- Task ID.
- Execution ID.
- Repository/organization.
- Action/capability.
- Resource target.
- Decision/result.
- Provider/model when AI is involved.
- Relevant branch/commit/PR references.
- Usage/cost metadata.
- Approval reference when applicable.

## Events to capture

- Task creation and cancellation.
- Context retrieval.
- Permission requests and decisions.
- Secret access requests and decisions.
- Tool invocations.
- Commands executed.
- Files read/changed where practical.
- Branch/commit/PR creation.
- Test results.
- Reviews and approvals.
- Merge/deploy actions.
- Policy denials and execution failures.

Audit records should be queryable, exportable, and resistant to silent modification.