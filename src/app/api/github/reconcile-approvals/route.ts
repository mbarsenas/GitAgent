import { NextResponse } from 'next/server';
import { reconcileLegacyApprovalProvenance } from '@/lib/governance/approval-reconciliation';

export async function POST() {
  try {
    const result = await reconcileLegacyApprovalProvenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
