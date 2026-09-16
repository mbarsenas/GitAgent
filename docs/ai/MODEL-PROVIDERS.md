# Model Providers

GitAgent is model-neutral.

## Initial provider targets

- OpenAI / Codex
- Anthropic Claude
- Google Gemini
- OpenAI-compatible endpoints

## Provider interface

Providers should expose a normalized internal contract for:

- Model discovery/configuration.
- Prompt/context submission.
- Tool invocation.
- Streaming output.
- Token/usage accounting.
- Error normalization.
- Cancellation.

Provider-specific behavior stays behind adapters. Repository workflows should target GitAgent capabilities rather than provider SDKs directly.

## Selection

Model selection may be based on task type, organization/repository policy, cost ceiling, latency requirement, capability requirement, or explicit user choice.

## Credentials

Provider credentials are stored as secret references and are never committed to repositories or exposed to an execution unless its policy permits use.