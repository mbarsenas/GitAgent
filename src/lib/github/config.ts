import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type GitHubAppConfig = {
  appId: string;
  appSlug: string;
  clientId?: string;
  privateKey?: string;
  privateKeyPath?: string;
  webhookSecret?: string;
  installationId?: string;
};

export function getGitHubAppConfig(): GitHubAppConfig {
  return {
    appId: process.env.GITHUB_APP_ID ?? '',
    appSlug: process.env.GITHUB_APP_SLUG ?? 'gitagent-control',
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH,
    webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID,
  };
}

export function getGitHubAppPrivateKey(config = getGitHubAppConfig()) {
  if (config.privateKey) {
    return config.privateKey.replace(/\\n/g, '\n');
  }

  if (config.privateKeyPath) {
    return readFileSync(resolve(process.cwd(), config.privateKeyPath), 'utf8');
  }

  throw new Error('GitHub App private key is not configured.');
}

export function isGitHubAppConfigured(config = getGitHubAppConfig()) {
  return Boolean(
    config.appId &&
      config.appSlug &&
      config.installationId &&
      (config.privateKey || config.privateKeyPath),
  );
}
