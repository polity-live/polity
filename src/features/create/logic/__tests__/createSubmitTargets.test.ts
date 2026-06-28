import { describe, expect, it } from 'vitest';

import {
  createExternalSubmitTarget,
  createRouteSubmitTarget,
  getCreateSubmitTargetLabelKey,
} from '../createSubmitTargets';

describe('create submit targets', () => {
  it('uses translation keys for common create destinations', () => {
    expect(getCreateSubmitTargetLabelKey('group')).toBe('pages.create.targets.group');
    expect(getCreateSubmitTargetLabelKey('event')).toBe('pages.create.targets.event');
    expect(getCreateSubmitTargetLabelKey('amendment')).toBe('pages.create.targets.amendment');
    expect(getCreateSubmitTargetLabelKey('blog')).toBe('pages.create.targets.blog');
    expect(getCreateSubmitTargetLabelKey('agenda_item')).toBe('pages.create.targets.agendaItem');
  });

  it('creates route and external targets with default label keys', () => {
    expect(
      createRouteSubmitTarget('group', {
        to: '/group/$id',
        params: { id: 'group-1' },
      })
    ).toEqual({
      kind: 'route',
      entityType: 'group',
      label: undefined,
      labelKey: 'pages.create.targets.group',
      to: '/group/$id',
      params: { id: 'group-1' },
      search: undefined,
      hash: undefined,
    });

    expect(createExternalSubmitTarget('event', { href: 'https://example.test' })).toEqual({
      kind: 'external',
      entityType: 'event',
      label: undefined,
      labelKey: 'pages.create.targets.event',
      href: 'https://example.test',
    });
  });

  it('keeps custom labels for custom return targets', () => {
    expect(
      createRouteSubmitTarget('group', {
        label: 'Back to workspace',
        to: '/group/$id',
        params: { id: 'group-1' },
      })
    ).toMatchObject({
      label: 'Back to workspace',
      labelKey: undefined,
    });
  });
});
