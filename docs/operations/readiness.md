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

## Completed execution workflow

New executions now run the nine boundary checks automatically after independent review and before becoming ready for human approval. The security-suite POST is now owner-authorized and runs denial probes plus evidence verification only; it no longer submits reviews or creates approvals. Historical generic review events cannot satisfy its commit-bound checks. This supersedes the side-effect description above for current releases.

`GET /api/health` is a public, uncached operational probe: it checks database connectivity and reports only configuration booleans for the implementation model, GitHub Apps, and session signing. It never returns credentials, user data, or provider error text. HTTP 200 means those dependencies are reachable/configured, not that an authenticated model/GitHub execution has been completed.

Release verification includes type checks, regression tests, production build, dependency audit, browser checks, and production health. A fresh authenticated coding task is still required to verify real model access, GitHub installation permissions, isolated validation, independent review, and human merge against production credentials.

Restricted agents now create one `CREATED` execution with an execution-bound approval and a waiting task. The task form directs the owner to approvals without starting the run. Approving resumes that same execution through the normal runner. Quarantined agents cannot create tasks, and reviewer identities are not offered as implementation agents.
