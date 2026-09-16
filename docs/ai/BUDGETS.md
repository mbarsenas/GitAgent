# Agent Budgets

Budgets constrain agent execution cost and resource consumption.

## Budget dimensions

- Maximum model tokens.
- Maximum monetary spend per task/execution.
- Maximum wall-clock execution time.
- Maximum CPU/memory allocation.
- Maximum tool invocations where useful.

## Enforcement

Budgets are evaluated before execution and monitored during execution. When a hard budget is exhausted, the execution stops safely and records a terminal `budget_exhausted` state.

Budget increases require an explicit policy decision or approval; agents cannot raise their own limits.

## Usage records

GitAgent should record provider, model, input/output token usage, estimated or actual cost, execution duration, and resource consumption for each execution.