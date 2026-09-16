# Contributing to GitAgent

GitAgent is built as an AI-native development platform. Changes should be traceable from idea through implementation, review, approval, merge, deployment, and audit.

## Required workflow

1. Create or reference an issue.
2. Define requirements and acceptance criteria.
3. Add or update an ADR when the change alters architecture, security boundaries, permissions, data ownership, runtime behavior, or provider strategy.
4. Create a feature branch.
5. Implement the change.
6. Update tests and documentation in the same change.
7. Open a pull request linked to the issue.
8. Run automated tests and AI review.
9. Obtain required human approval.
10. Merge using the repository's approved merge policy.
11. Deploy through the documented release workflow.
12. Ensure audit events and changelog entries are complete where applicable.

## Branch naming

Use clear prefixes such as:

- `feature/`
- `fix/`
- `docs/`
- `security/`
- `agent/`
- `infra/`

## Documentation standard

Significant behavior changes must update the relevant file under `docs/`. Architectural decisions belong in `docs/adr/`.

## AI-generated changes

AI-generated changes are permitted, but the agent identity, human initiator, permissions, provider/model, commands, changed files, test results, and approvals must be attributable through GitAgent's audit model when the platform runtime is available.

## Secrets

Never commit API keys, access tokens, passwords, private keys, production credentials, or customer data.