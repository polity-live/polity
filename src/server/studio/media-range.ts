/** Storage supports one byte range. Reject invalid ranges before issuing a media URL. */
export function validMediaRange(header: string, size: number): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || !Number.isSafeInteger(size) || size <= 0) return false;
  const [, start, end] = match;
  if (!start) return !!end && Number.isSafeInteger(Number(end)) && Number(end) > 0;
  const first = Number(start);
  if (!Number.isSafeInteger(first) || first >= size) return false;
  return !end || (Number.isSafeInteger(Number(end)) && Number(end) >= first);
}
