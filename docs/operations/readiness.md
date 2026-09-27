# GitAgent readiness verification

Task: make readiness reflect persisted repository execution evidence without bypassing governance checks.

Acceptance criteria:
- Recognize repository-specific implementation agents reviewed by an independent agent.
- Bind approval evidence to the actual execution, task, actor, and implementation identity.
- Count legacy `execution.completed` / `execution.failed` and current `agent.execution.completed` / `agent.execution.failed` events, once per execution per outcome.
- Scope evidence queries to the canonical GitAgent repository.
- Keep missing security-suite and denial-test evidence failing.

The authenticated `/api/github/readiness` report uses the most recent repository execution's implementation identity and its latest approving reviewer for identity/trust reporting. Before an execution or review exists it falls back to the legacy demo identities. Historical review evidence is evaluated against each event's own execution, not those display identities.

A successful build, or a completed and human-merged PR, does not establish every security boundary. The report still requires a passing security suite, observed self-approval denial, and observed agent merge denials. Do not seed audit events or alter trust merely to turn the report green.

The security-suite POST endpoint has side effects: it can submit GitHub reviews/approvals and request human merge approval. Inspect the specific execution and PR before invoking it; it is not a read-only health check. A production rollout and authenticated recheck are required before claiming this reporting fix is live.
