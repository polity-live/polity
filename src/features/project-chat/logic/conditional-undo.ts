import { ProjectToolError } from './contracts';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Fail closed on concurrent edits. A saved inverse is never a blind restore. */
export function conditionalUndo<T>(current: T, before: T, after: T): T {
  if (canonical(current) !== canonical(after)) {
    throw new ProjectToolError(
      'undo_conflict',
      'The resource has changed since this action.',
      'read_again'
    );
  }
  return structuredClone(before);
}
