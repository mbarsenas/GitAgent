'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RepositoryActions({ installationId }: { installationId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function syncRepositories() {
    setSyncing(true);
    setMessage('');
    try {
      const response = await fetch('/api/github/sync', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Repository sync failed');
      setMessage(`Synced ${result.repositoryCount} repositor${result.repositoryCount === 1 ? 'y' : 'ies'}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Repository sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <a className="ghost-button" href={`https://github.com/settings/installations/${installationId}`} target="_blank" rel="noreferrer">
        Manage repositories
      </a>
      <button className="solid-button" type="button" onClick={syncRepositories} disabled={syncing}>
        {syncing ? 'Syncing…' : '↻ Sync repositories'}
      </button>
      {message ? <span className="mono muted" style={{ fontSize: 10 }}>{message}</span> : null}
    </div>
  );
}
