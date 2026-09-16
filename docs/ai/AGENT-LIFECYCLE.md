# Agent Lifecycle

1. Task created from an issue, direct request, automation, or system event.
2. Repository context and governing policies are resolved.
3. Agent identity is selected.
4. Provider/model is selected according to policy and task type.
5. Requested capabilities are intersected with organization, repository, agent, and task limits.
6. Required approvals are evaluated.
7. Execution environment is created.
8. Context is assembled and supplied to the model.
9. Agent invokes approved tools and commands.
10. Budget, resource, network, and secret policies are enforced continuously.
11. Changes and test results are captured.
12. Git artifacts such as branches, commits, or pull requests are created only when authorized.
13. Review/approval gates execute.
14. Execution terminates as succeeded, failed, denied, cancelled, or budget-exhausted.
15. Complete audit records and usage/cost records are finalized.

An execution must never silently expand its own privileges.