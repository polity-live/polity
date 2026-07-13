export function assert(b, msg = 'Assertion failed') {
  if (!b) {
    throw new Error(typeof msg === 'string' ? msg : msg());
  }
}
export function unreachable() {
  throw new Error('Unreachable');
}
