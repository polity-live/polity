// Request handlers need the Start server compiler and must never execute in
// browser component tests. Child server boundaries are mocked by each suite.
export function getRequest(): never {
  throw new Error('Server request access is unavailable in browser component tests');
}
