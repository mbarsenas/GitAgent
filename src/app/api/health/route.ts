import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isImplementationLlmConfigured } from '@/lib/agent/llm';
import { isReviewAppConfigured } from '@/lib/github/review-auth';
import { getGitHubAppConfig } from '@/lib/github/config';

export const dynamic = 'force-dynamic';
export async function GET() {
  let database = false;
  try { await prisma.$queryRaw`SELECT 1`; database = true; } catch { /* Only publish status, never connection details. */ }
  const config = getGitHubAppConfig();
  const checks = {
    database,
    implementationModel: isImplementationLlmConfigured(),
    githubApp: Boolean(config.appId && (config.privateKey || config.privateKeyPath)),
    reviewApp: isReviewAppConfigured(),
    sessions: Boolean(process.env.AUTH_SECRET),
  };
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, service: 'gitagent', checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
