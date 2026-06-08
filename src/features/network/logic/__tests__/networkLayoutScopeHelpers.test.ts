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
  it('falls back to the legacy plain group id when the namespaced key is missing', () => {
    const layouts: GroupNetworkLayouts = {
      'group-123': SAMPLE_LAYOUT,
    };

    expect(getPersistedNetworkLayout(layouts, 'group:group-123', ['group-123'])).toEqual(
      SAMPLE_LAYOUT
    );
  });

  it('writes the namespaced key and drops the legacy fallback key', () => {
    const layouts: GroupNetworkLayouts = {
      'group-123': SAMPLE_LAYOUT,
    };

    expect(
      savePersistedNetworkLayouts({
        layouts,
        scopeKey: 'group:group-123',
        layout: SAMPLE_LAYOUT,
        legacyScopeKeys: ['group-123'],
      })
    ).toEqual({
      'group:group-123': SAMPLE_LAYOUT,
    });
  });

  it('resets both the namespaced key and any legacy fallback keys together', () => {
    const layouts: GroupNetworkLayouts = {
      'group:group-123': SAMPLE_LAYOUT,
      'group-123': SAMPLE_LAYOUT,
      'user:user-1': SAMPLE_LAYOUT,
    };

    expect(
      resetPersistedNetworkLayouts({
        layouts,
        scopeKey: 'group:group-123',
        legacyScopeKeys: ['group-123'],
      })
    ).toEqual({
      'user:user-1': SAMPLE_LAYOUT,
    });
  });
});
