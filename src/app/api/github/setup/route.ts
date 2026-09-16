import { NextResponse } from 'next/server';
import { getGitHubAppConfig, isGitHubAppConfigured } from '@/lib/github/config';

export async function GET() {
  const config = getGitHubAppConfig();

  return NextResponse.json({
    configured: isGitHubAppConfigured(config),
    appId: config.appId || null,
    appSlug: config.appSlug,
    installationId: config.installationId || null,
    hasPrivateKey: Boolean(config.privateKey),
    hasWebhookSecret: Boolean(config.webhookSecret),
    hasClientId: Boolean(config.clientId),
  });
}
