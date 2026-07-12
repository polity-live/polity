// @ts-nocheck -- vendored compatibility implementation; exercised through its typed adapter API.
export function assert(b, msg = 'Assertion failed') {
  if (!b) {
    throw new Error(typeof msg === 'string' ? msg : msg());
  }
}
export function unreachable(_) {
  throw new Error('Unreachable');
}
