# Review Agent Isolation Guarantees

GitAgent treats implementation agents and review agents as separate security principals. The review boundary must be enforced by credentials and runtime permissions, not by prompt instruction.

## Core invariant

**An implementation agent can never approve its own work.**

This is enforced structurally:
- implementation and review agents have different identities
- implementation and review agents receive different capability grants
- review agents do not inherit implementation credentials
- approval actions reject attempts from the implementation identity associated with the change

## MVP review-agent capability profile

A review agent may receive:
- repository read access
- pull-request/diff read access
- test/lint/security-analysis execution
- comment/review submission
- typed finding creation
- trust-signal emission

A review agent must not receive by default:
- write access to the implementation branch
- force-push capability
- merge capability
- branch-protection administration
- production deployment capability
- unrestricted secret access

## Execution isolation

Review execution should run in a fresh sandbox separate from the implementation sandbox.

Minimum guarantees:
- fresh filesystem/worktree or immutable checkout
- separate short-lived credential set
- no reuse of implementation-agent tokens
- no inherited shell/session state
- no inherited writable workspace
- explicit network policy
- explicit CPU/memory/time budget
- audit logging of commands, tools, files, network decisions, and outputs

## Code under review is untrusted input

Review agents may execute tests against attacker-controlled or agent-generated repository content. Therefore:
- test execution occurs in a disposable sandbox
- privileged host mounts are denied
- Docker socket access is denied by default
- host credential directories are not mounted
- outbound network is deny-by-default or allowlisted by policy
- secrets are withheld unless a specific policy permits narrowly scoped access
- execution terminates on sandbox escape or forbidden capability signals

## Credential model

Credentials are minted per execution where possible and expire automatically.

A review credential should be scoped to the minimum operations required for the review. For example, a review principal may read repository content and submit a review but cannot update refs.

## Independent evidence

Review-agent output must identify:
- reviewer agent identity
- model/provider
- execution ID
- policy version
- commit/PR reviewed
- analysis tools executed
- typed findings and severity
- test/security results
- uncertainty/confidence metadata where applicable

The review result becomes evidence for the trust evaluator. It does not directly mutate the implementation agent's trust state outside the policy engine.

## Separation of duties

GitAgent should reject the following combinations by default:
- same agent identity implements and approves
- same execution credential writes implementation code and approves it
- implementation agent grants itself review/merge rights
- review agent modifies the implementation branch and subsequently approves the resulting work

Organizations may add additional separation policies, such as requiring a human approval after AI review for security-sensitive repositories.

## Demonstrable guarantee

The product demo should prove separation rather than merely describe it:

1. Implementation agent creates a branch and PR with a credential that can write that branch but cannot approve/merge.
2. Review agent launches in a fresh sandbox with a separate credential that can read/analyze/comment but cannot write the implementation branch.
3. Attempting a forbidden operation under either identity is denied and recorded as an audit event.
4. The final timeline shows the two principals and capability sets independently.

This makes separation of duties a testable platform property rather than a prompt convention.
