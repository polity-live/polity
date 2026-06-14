import { describe, expect, it } from 'vitest';
import type { GroupNetworkLayout, GroupNetworkLayouts } from '@/zero/preferences';
import {
  getPersistedNetworkLayout,
  resetPersistedNetworkLayouts,
  savePersistedNetworkLayouts,
} from '../networkLayoutScopeHelpers';

const SAMPLE_LAYOUT: GroupNetworkLayout = {
  node_positions: {
    'group-a': { x: 10, y: 20 },
  },
  edge_bend_points: {},
};

describe('networkLayoutScopeHelpers', () => {
  it('returns null when the scoped layout key is missing', () => {
    const layouts: GroupNetworkLayouts = {
      'group-123': SAMPLE_LAYOUT,
    };

    expect(getPersistedNetworkLayout(layouts, 'group:group-123')).toBeNull();
  });

  it('writes only the scoped key and leaves unrelated layouts untouched', () => {
    const layouts: GroupNetworkLayouts = {
      'group-123': SAMPLE_LAYOUT,
    };

    expect(
      savePersistedNetworkLayouts({
        layouts,
        scopeKey: 'group:group-123',
        layout: SAMPLE_LAYOUT,
      })
    ).toEqual({
      'group-123': SAMPLE_LAYOUT,
      'group:group-123': SAMPLE_LAYOUT,
    });
  });

  it('resets only the scoped key', () => {
    const layouts: GroupNetworkLayouts = {
      'group:group-123': SAMPLE_LAYOUT,
      'group-123': SAMPLE_LAYOUT,
      'user:user-1': SAMPLE_LAYOUT,
    };

    expect(
      resetPersistedNetworkLayouts({
        layouts,
        scopeKey: 'group:group-123',
      })
    ).toEqual({
      'group-123': SAMPLE_LAYOUT,
      'user:user-1': SAMPLE_LAYOUT,
    });
  });
});
