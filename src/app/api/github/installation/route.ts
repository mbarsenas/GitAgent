import { NextResponse } from 'next/server';
import { getGitHubInstallationState } from '@/lib/github/installation';

export async function GET() {
  return NextResponse.json(getGitHubInstallationState());
}
