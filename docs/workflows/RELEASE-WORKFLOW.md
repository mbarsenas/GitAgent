# Release Workflow

1. Select the approved release commit/tag candidate.
2. Confirm CI, security scans, migration checks, and documentation checks are green.
3. Review `CHANGELOG.md` and release notes.
4. Require human approval for production release unless repository policy explicitly says otherwise.
5. Build immutable release artifacts.
6. Deploy to staging and run smoke tests.
7. Promote the same approved artifact to production.
8. Record deployment actor, agent if involved, commit SHA, artifact digest, environment, approvals, and result.
9. Verify health checks and rollback readiness.
10. Close the release with audit and incident references if applicable.

Code-write permission never implies production-deploy permission.