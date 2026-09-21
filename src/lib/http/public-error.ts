export function publicError(error: unknown, fallback: string) {
  // Provider responses can contain request metadata or echoed credentials.
  // Only explicitly classified, user-safe errors may cross an API boundary.
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return 'UNAUTHENTICATED';
  return fallback;
}
