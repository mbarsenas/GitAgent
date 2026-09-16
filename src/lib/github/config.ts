export type GitHubAppConfig = {
  appId: string;
  appSlug: string;
  clientId?: string;
  privateKey?: string;
  webhookSecret?: string;
  installationId?: string;
};

export function getGitHubAppConfig(): GitHubAppConfig {
  return {
    appId: process.env.GITHUB_APP_ID ?? '',
    appSlug: process.env.GITHUB_APP_SLUG ?? 'gitagent',
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID,
  };
}

export function isGitHubAppConfigured(config = getGitHubAppConfig()) {
  return Boolean(config.appId && config.appSlug && config.privateKey);
}
