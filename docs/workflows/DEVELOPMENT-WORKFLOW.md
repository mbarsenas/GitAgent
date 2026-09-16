# GitAgent Development Workflow

This is the canonical workflow for product and code changes.

## 1. Idea
Capture the problem, opportunity, or requested capability.

## 2. Issue
Create an issue that states the user or platform problem. Avoid starting implementation from an undocumented chat instruction when the work is significant.

## 3. Requirements and acceptance criteria
Document expected behavior, constraints, security implications, compatibility requirements, and objective acceptance criteria.

## 4. Architecture decision when needed
Create an ADR when the change affects platform architecture, security boundaries, data ownership, model/provider strategy, runtime isolation, permission semantics, or another durable design choice.

## 5. Agent task
Create a bounded task containing:
- goal
- repository
- base branch
- relevant issue/ADR references
- model/provider
- permissions
- execution environment
- secret policy
- network policy
- token/cost/time budget
- approval requirements
- validation requirements

## 6. Branch
Work on a dedicated branch. Direct agent writes to protected branches should be denied by default.

## 7. AI execution
The agent may:
- discover relevant context
- read files within scope
- edit code and documentation
- execute approved tools/commands
- run tests and validation

The runtime records these actions as audit events.

## 8. Validation
Applicable checks should include:
- unit/integration tests
- linting
- type checking
- security scanning
- policy checks
- budget checks
- documentation consistency

Failures must be visible in the task timeline.

## 9. Pull request
The PR should include:
- linked issue/task
- linked ADR when applicable
- summary of changes
- agent/model identity
- tests performed and results
- risk notes
- documentation changes
- approvals required

## 10. Review
Review may combine deterministic tooling, AI review, and human review. Review agents receive separate identities and permission scopes from implementation agents.

## 11. Approval
Policies determine whether a human must approve operations such as merge, secret use, infrastructure changes, production deployment, or budget escalation.

## 12. Merge
Merge occurs only when branch protection, checks, review, and approval policy are satisfied.

## 13. Deploy
Deployment is a separately permissioned action. Code-write permission does not imply deploy permission.

## 14. Audit record
The final timeline links the human initiator, issue, task, agent, model, permissions, context, execution, tests, approvals, commits, PR, merge, and deployment.

## 15. Documentation and changelog
Behavioral, architectural, operational, security, and public-facing changes must update the corresponding documentation in the same workflow. Release-significant changes update `CHANGELOG.md`.

## Definition of done
A change is not complete merely because code compiles. It is complete when acceptance criteria pass, required documentation is current, policy requirements are satisfied, and the execution is auditable.
