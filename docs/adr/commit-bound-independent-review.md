# Commit-bound independent review and execution verification

Status: accepted for the GitAgent MVP completion task.

The previous review principal posted generic comments and approvals without inspecting changes. Approval events were bound to a PR number but not its head commit, and repeated run requests could start the same execution more than once.

The reviewer now reads the complete supported PR diff with its separate GitHub App, obtains a structured independent model verdict, and records the inspected head SHA. Missing patches, more than 100 changed files, oversized diffs, malformed model output, blocking findings, and head changes fail closed. The model receives repository text as untrusted data and has no tools or implementation credentials. Its provider API key is used by the server, never sent in the prompt.

Approval requires a clean recorded review for the same commit. Merge requires independent approval, human approval, and successful execution security checks for that commit. GitHub receives the expected SHA to prevent a race between the final lookup and merge. Already-merged historical PRs retain the existing recovery path; unmerged legacy approvals require a fresh commit-bound review and human decision.

Execution startup uses a conditional CREATED-to-RUNNING database update. Only the winning caller proceeds. Post-claim failures mark execution/task failed and seal an existing workspace. Missing provider configuration is a failure, not a successful inspection.

Each reviewed execution exercises the real denial functions for self approval, protected-branch writes, cross-workspace writes, and implementation/reviewer merges. The security suite records its actual results and verifies positive review and human-gate evidence. It does not post reviews or manufacture successful tasks. Demo trust mutation endpoints are retired with HTTP 410.

This does not claim that a model review proves correctness. Tests and isolated repository validation remain required. Provider failure and unsupported diff sizes require another reviewed task or operator intervention.
