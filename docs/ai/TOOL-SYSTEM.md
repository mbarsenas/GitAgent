# Tool System

Agents act through explicit tools rather than unrestricted ambient access.

## Tool categories

- Repository read/search.
- File modification.
- Git branch/commit operations.
- Issue and pull request operations.
- Test/build execution.
- Package manager operations.
- Approved network requests.
- Secret retrieval by reference.
- Deployment actions.

## Authorization

Every tool invocation is checked against effective capabilities, task scope, environment policy, budget, and approval state before execution.

## Tool contract

Each tool should define:
- Input schema.
- Required capability.
- Side-effect classification.
- Audit event type.
- Timeout/resource behavior.
- Idempotency expectations.
- Error model.

## Safety

High-impact tools such as secret access, destructive repository operations, protected-branch merge, and production deployment should support mandatory approval gates.

Tool output is data and must not be treated as authority to alter platform policy.