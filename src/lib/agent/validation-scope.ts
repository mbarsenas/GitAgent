export function isDocumentationOnly(paths: string[]) {
  return paths.length > 0 && paths.every((file) =>
    /^(?:README\.md|(?:docs|documentation)\/.*\.mdx?)$/i.test(file),
  );
}

export function validateRepositoryPath(file: string) {
  if (!file || file.includes('\\') || file.includes('\0') || file.startsWith('/') ||
      file.split('/').some((part) => part === '..' || part === '.' || !part)) {
    throw new Error('Repository snapshot contains an unsafe path.');
  }
  return file;
}
