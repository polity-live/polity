import type { Descendant } from 'slate';
export const MAX_STATE_BYTES = 12_000_000;
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export function textValue(value: unknown): Descendant[] {
  if (typeof value === 'string') return [{ type: 'p', children: [{ text: value }] } as Descendant];
  if (value == null || (Array.isArray(value) && !value.length))
    return [{ type: 'p', children: [{ text: '' }] } as Descendant];
  if (!Array.isArray(value)) throw new Error('invalid_text');
  let count = 0;
  const visit = (node: unknown, depth: number): void => {
    if (++count > 100_000 || depth > 64 || !node || typeof node !== 'object' || Array.isArray(node))
      throw new Error('invalid_text');
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') return;
    if (!Array.isArray(n.children)) throw new Error('invalid_text');
    n.children.forEach(child => visit(child, depth + 1));
  };
  value.forEach(node => visit(node, 0));
  return value as Descendant[];
}
