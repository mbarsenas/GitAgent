import { getGitHubAppConfig, isGitHubAppConfigured } from './config';

export type GitHubInstallationState = {
  configured: boolean;
  installed: boolean;
  appId?: string;
  appSlug?: string;
  installationId?: string;
  installUrl?: string;
  manageUrl: string;
};

export function getGitHubInstallationState(): GitHubInstallationState {
  const config = getGitHubAppConfig();
  const appSlug = config.appSlug || 'gitagent-control';
  const installationId = config.installationId;

  return {
    configured: isGitHubAppConfigured(config),
    installed: Boolean(installationId),
    appId: config.appId,
    appSlug,
    installationId,
    installUrl: appSlug ? `https://github.com/apps/${appSlug}/installations/new` : undefined,
    manageUrl: 'https://github.com/settings/installations',
  };
}
