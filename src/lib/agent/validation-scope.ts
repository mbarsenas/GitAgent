export function isDocumentationOnly(paths: string[]) {
  return paths.length > 0 && paths.every((file) =>
    /^(?:README\.md|(?:docs|documentation)\/.*\.mdx?)$/i.test(file),
  );
}
