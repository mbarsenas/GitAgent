# Code Review Workflow

GitAgent supports layered review rather than relying on a single reviewer.

## Review layers

- Deterministic checks: lint, type checks, unit/integration tests, policy checks, security scans.
- AI review: independent reviewer agent examines correctness, regressions, security, maintainability, and documentation.
- Human review: required according to repository policy and always available for escalation.

## Separation of duties

An implementation agent must not approve its own work. Reviewer agents should use a distinct identity and separate permission scope.

## Review output

Reviews should identify:
- Blocking defects.
- Security or permission concerns.
- Test gaps.
- Behavioral regressions.
- Documentation gaps.
- Non-blocking suggestions.

## Merge gate

A PR may merge only after required checks, reviews, and approvals have passed or been explicitly waived by an authorized human according to policy.