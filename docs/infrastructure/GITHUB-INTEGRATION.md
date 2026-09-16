# GitHub Integration

GitAgent connects to GitHub through a GitHub App, not a long-lived personal access token.

## Current development installation

The connected GitHub App installation for `mbarsenas` is installation `153014649` and currently exposes the repositories selected for that installation, including `mbarsenas/GitAgent`.

## Required application configuration

GitAgent expects:

- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`

These values must be supplied through environment or secret storage and must never be committed.

## MVP repository workflow

For an implementation task:

1. Resolve the GitHub App installation and repository.
2. Request a short-lived installation token scoped to that installation/repository.
3. Create a task branch from the repository default branch.
4. Write one or more commits to the task branch.
5. Open a draft pull request.
6. Expire/discard the implementation token.
7. Launch a separate review identity with a separate credential envelope.
8. Record every GitHub action in `AuditEvent`.

The implementation identity must not approve or merge its own pull request.

## First integration milestone

The first real integration test will target `mbarsenas/GitAgent` and should:

- resolve the repository through the GitHub App installation
- create a governed branch
- create a small text-file commit on that branch
- open a draft pull request back to `main`
- record branch creation, commit, and PR creation in GitAgent audit history

## Security boundary

The application should mint installation tokens only when a governed task reaches the execution step. Tokens should be short-lived, repository-scoped where possible, and never stored in the database as reusable credentials.
