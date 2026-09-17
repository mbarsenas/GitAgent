type CodingFile = { path: string; content: string };
export type CodingPlan = {
  summary: string;
  files: Array<{ path: string; reason: string }>;
  proposedChanges: Array<{ path: string; content: string; message: string }>;
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';

export function isImplementationLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

async function callImplementationModel(prompt: string): Promise<CodingPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: prompt,
    }),
  });

  const body = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`OpenAI Responses API ${response.status}: ${body.error?.message ?? 'request failed'}`);
  }

  const text =
    body.output_text ??
    body.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text' || typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('\n') ??
    '';

  if (!text.trim()) throw new Error('OpenAI returned no implementation plan.');

  const parsed = JSON.parse(extractJson(text)) as CodingPlan;
  if (!Array.isArray(parsed.files) || !Array.isArray(parsed.proposedChanges) || typeof parsed.summary !== 'string') {
    throw new Error('OpenAI returned an invalid coding plan shape.');
  }

  return parsed;
}

export async function generateCodingPlan(input: {
  goal: string;
  repository: string;
  defaultBranch: string;
  files: CodingFile[];
}): Promise<CodingPlan> {
  const context = input.files
    .map((file) => `\n--- FILE: ${file.path} ---\n${file.content.slice(0, 30000)}`)
    .join('\n');

  const prompt = `You are the implementation engine for GitAgent, a governed GitHub coding agent.\n\nRepository: ${input.repository}\nDefault branch: ${input.defaultBranch}\nTask goal: ${input.goal}\n\nUse only the repository files supplied below. Produce a conservative implementation plan and complete replacement content for each file that must change. Do not invent files unless the task clearly requires a new file. Preserve unrelated code.\n\nReturn ONLY valid JSON with this exact shape:\n{\n  \"summary\": \"short summary\",\n  \"files\": [{\"path\":\"path\",\"reason\":\"why relevant\"}],\n  \"proposedChanges\": [{\"path\":\"path\",\"content\":\"complete UTF-8 file content\",\"message\":\"concise commit message\"}]\n}\n\nRepository context:${context}`;

  return callImplementationModel(prompt);
}

export async function generateValidationRepair(input: {
  goal: string;
  repository: string;
  files: CodingFile[];
  validation: Array<{ label: string; command: string; exitCode: number; stdout: string; stderr: string }>;
  attempt: number;
}): Promise<CodingPlan> {
  const context = input.files
    .map((file) => `\n--- CURRENT FILE: ${file.path} ---\n${file.content.slice(0, 30000)}`)
    .join('\n');
  const failures = input.validation
    .filter((item) => item.exitCode !== 0)
    .map(
      (item) =>
        `\n--- VALIDATION FAILURE: ${item.label} ---\nCommand: ${item.command}\nExit code: ${item.exitCode}\nSTDOUT:\n${item.stdout.slice(-12000)}\nSTDERR:\n${item.stderr.slice(-12000)}`,
    )
    .join('\n');

  const prompt = `You are repairing a failed implementation for GitAgent.\n\nRepository: ${input.repository}\nOriginal task: ${input.goal}\nRepair attempt: ${input.attempt}\n\nFix only the supplied files. Do not invent new paths. Use the validation failures as primary evidence. Preserve unrelated behavior. Return complete replacement content only for files that need another change. If the failure cannot be repaired from the supplied context, return an empty proposedChanges array.\n\nReturn ONLY valid JSON with this exact shape:\n{\n  \"summary\": \"short repair summary\",\n  \"files\": [{\"path\":\"path\",\"reason\":\"why relevant\"}],\n  \"proposedChanges\": [{\"path\":\"path\",\"content\":\"complete UTF-8 file content\",\"message\":\"concise repair commit message\"}]\n}\n\nCurrent implementation:${context}\n\nValidation evidence:${failures}`;

  return callImplementationModel(prompt);
}
