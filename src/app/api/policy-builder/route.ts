import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';

type PolicyDraft = {
  summary: string;
  capabilities: {
    repositoryRead: boolean;
    branchCreate: boolean;
    branchWrite: boolean;
    testsExecute: boolean;
    pullRequestCreate: boolean;
  };
  approvals: {
    sensitiveTransitions: boolean;
    workflowChanges: boolean;
    dependencyChanges: boolean;
  };
  hardBoundaries: {
    secretsRead: false;
    selfReview: false;
    selfApprove: false;
    selfMerge: false;
  };
  instructions: string;
};

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = /^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

export async function POST(request: Request) {
  try {
    await requireCurrentUser();
    const { description } = (await request.json()) as { description?: string };
    if (!description?.trim()) return NextResponse.json({ ok: false, error: 'Describe how you want the agent constrained.' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: 'AI policy generation is not configured.' }, { status: 503 });

    const prompt = `You are the policy drafting assistant for GitAgent, a governed GitHub coding-agent control plane.
Translate the user's plain-English intent into a conservative GitAgent policy proposal.

GitAgent hard boundaries cannot be weakened:
- implementation agents cannot review, approve, or merge their own work
- review agents cannot write implementation branches or merge
- secrets.read is denied for this builder
- ambiguous risky actions should require human approval, not silently allow

User request:
${description}

Return ONLY valid JSON:
{
  "summary": "plain-English one paragraph summary",
  "capabilities": {
    "repositoryRead": true,
    "branchCreate": true,
    "branchWrite": true,
    "testsExecute": true,
    "pullRequestCreate": true
  },
  "approvals": {
    "sensitiveTransitions": true,
    "workflowChanges": true,
    "dependencyChanges": true
  },
  "hardBoundaries": {
    "secretsRead": false,
    "selfReview": false,
    "selfApprove": false,
    "selfMerge": false
  },
  "instructions": "concise generated GitAgent constraint instructions suitable for review"
}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: prompt }),
    });
    const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || `OpenAI request failed (${response.status})`);

    const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('\n') ?? '';
    const draft = JSON.parse(extractJson(text)) as PolicyDraft;

    // Server-enforced invariants: generated text can never weaken these boundaries.
    draft.hardBoundaries = { secretsRead: false, selfReview: false, selfApprove: false, selfMerge: false };

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Policy generation failed' }, { status: 500 });
  }
}
