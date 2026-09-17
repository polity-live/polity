import { describe, expect, it } from 'vitest';
import { previewHref, previewTargetFromHref, previewTargetFromHash } from '../preview-target';
describe('preview URLs', () => {
  it.each([
    ['todo', '/todos/task-1'],
    ['event', '/event/task-1'],
    ['amendment', '/amendment/task-1'],
  ] as const)('preserves the %s detail URL', (kind, href) => {
    expect(previewTargetFromHref(href)).toEqual({ kind, id: 'task-1' });
    expect(previewTargetFromHash(`preview=${kind}:task-1`)).toEqual({ kind, id: 'task-1' });
    expect(previewHref({ kind, id: 'task-1' })).toBe(href);
  });
  it('leaves ordinary anchors and nested detail routes alone', () => {
    expect(previewTargetFromHash('todos')).toBeNull();
    expect(previewTargetFromHref('/event/task-1/agenda')).toBeNull();
    expect(previewTargetFromHref('https://example.com/event/task-1')).toBeNull();
  });
});
