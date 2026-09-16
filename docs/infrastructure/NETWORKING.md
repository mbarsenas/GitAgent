# Networking

AI execution environments should use deny-by-default network egress where practical.

## Policy goals

- Repository access only to approved Git endpoints.
- Model-provider access only to configured provider endpoints.
- Package registries restricted to approved domains.
- Production services inaccessible unless the task explicitly requires and is approved for them.
- No lateral access to unrelated tenant or repository services.

## Controls

Network policy should be attached to the execution identity and recorded in the audit trail. Temporary exceptions must be scoped to the task and expire with the execution.