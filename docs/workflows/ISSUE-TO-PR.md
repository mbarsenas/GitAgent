# Issue to Pull Request

## Issue requirements

A development issue should contain:
- Problem statement.
- Desired outcome.
- Acceptance criteria.
- Security/privacy considerations.
- Dependencies.
- Relevant ADRs.
- Whether AI execution is expected.

## Branch

Create a dedicated branch from the approved base branch. Agents should not write directly to protected branches.

## Pull request

The PR should link the issue and include:
- Summary.
- Implementation notes.
- Agent/model identity when AI contributed.
- Tests executed and results.
- Risk/security notes.
- Documentation changes.
- Required approvals.

## Completion

The issue is closed when acceptance criteria are met, required checks and approvals pass, the change is merged, and any required deployment/documentation work is complete.