# Storage

GitAgent separates application data, Git repository data, execution workspaces, artifacts, and audit data.

## Storage classes

- PostgreSQL: application/control-plane metadata.
- Git storage: repositories, refs, objects, and related Git backend state.
- Execution workspace: ephemeral task filesystem.
- Artifact storage: approved build/test/release outputs.
- Audit storage: durable append-oriented event records.
- Secret store: secret values referenced by ID; never stored in source control.

## Design goals

- Independent backup/restore policies.
- Clear tenant/repository ownership.
- Encryption in transit and at rest where supported.
- Retention policies by data class.
- No accidental persistence of execution secrets.

Execution workspaces are disposable. Durable results are promoted explicitly into Git, artifact, audit, or application storage.