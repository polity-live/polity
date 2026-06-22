import { describe, expect, it } from 'vitest';
import { GROUP_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { getActionRightSections } from '../actionRightSections';

describe('getActionRightSections', () => {
  it('covers every configured action right exactly once', () => {
    const sections = getActionRightSections();
    const keys = sections.flatMap(section =>
      section.rights.map(right => `${right.resource}:${right.action}`)
    );

    expect(keys).toHaveLength(GROUP_ACTION_RIGHTS.length);
    expect(new Set(keys).size).toBe(GROUP_ACTION_RIGHTS.length);
  });

  it('groups operation rights together', () => {
    const sections = getActionRightSections();
    const operations = sections.find(section => section.id === 'operations');

    expect(operations?.rights.map(right => right.label)).toEqual(
      expect.arrayContaining([
        'Manage Documents',
        'View Documents',
        'Manage Links',
        'View Links',
        'Manage Payments',
        'View Payments',
        'Manage Todos',
        'View Todos',
      ])
    );
  });

  it('falls back to an other section for uncategorized rights', () => {
    const sections = getActionRightSections([
      { resource: 'customResource', action: 'view', label: 'View Custom Resource' },
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe('other');
    expect(sections[0]?.rights[0]?.label).toBe('View Custom Resource');
  });
});
