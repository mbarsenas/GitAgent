import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ ok: false, error: 'Demo trust mutation is retired. Use real governed executions and owner-authorized trust actions.' }, { status: 410 });
}
