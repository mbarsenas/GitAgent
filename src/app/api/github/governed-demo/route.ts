import { NextResponse } from 'next/server';
import { runGovernedDemo } from '@/lib/github/governed-demo';

export async function POST() {
  try {
    const result = await runGovernedDemo();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
