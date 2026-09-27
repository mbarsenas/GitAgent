import { requireCurrentUser } from '@/lib/auth/current-user';
import { NextResponse } from 'next/server';
import { reconcileLegacyApprovalProvenance } from '@/lib/governance/approval-reconciliation';

export async function POST() {
  try {
    const session = await requireCurrentUser();
    const result = await reconcileLegacyApprovalProvenance(session.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
