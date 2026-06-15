import { describe, expect, it } from 'vitest';

import {
  createExternalSubmitTarget,
  createRouteSubmitTarget,
  getCreateSubmitTargetLabel,
} from '../createSubmitTargets';

describe('create submit targets', () => {
  it('uses civic entity labels for common create destinations', () => {
    expect(getCreateSubmitTargetLabel('group')).toBe('Zur Gruppe');
    expect(getCreateSubmitTargetLabel('event')).toBe('Zum Event');
    expect(getCreateSubmitTargetLabel('amendment')).toBe('Zum Antrag');
    expect(getCreateSubmitTargetLabel('blog')).toBe('Zum Blog');
    expect(getCreateSubmitTargetLabel('agenda_item')).toBe('Zur Agenda');
  });

  it('creates route and external targets with default labels', () => {
    expect(
      createRouteSubmitTarget('group', {
        to: '/group/$id',
        params: { id: 'group-1' },
      })
    ).toEqual({
      kind: 'route',
      entityType: 'group',
      label: 'Zur Gruppe',
      to: '/group/$id',
      params: { id: 'group-1' },
      search: undefined,
      hash: undefined,
    });

    expect(createExternalSubmitTarget('event', { href: 'https://example.test' })).toEqual({
      kind: 'external',
      entityType: 'event',
      label: 'Zum Event',
      href: 'https://example.test',
    });
  });
});
