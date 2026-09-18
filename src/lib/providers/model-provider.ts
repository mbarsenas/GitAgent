export type ModelRequest = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

export type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

export type ModelResponse = {
  text: string;
  usage?: ModelUsage;
  raw?: unknown;
};

export interface ModelProvider {
  readonly key: string;
  readonly displayName: string;
  invoke(model: string, request: ModelRequest): Promise<ModelResponse>;
  healthcheck?(): Promise<{ ok: boolean; detail?: string }>;
}

export type ProviderFactory = (config: Record<string, unknown>) => ModelProvider;
