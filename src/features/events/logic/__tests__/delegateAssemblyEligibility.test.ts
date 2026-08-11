import { describe, expect, it } from 'vitest';

import { canCreateDelegateAssemblyForGroup } from '../delegateAssemblyEligibility';

describe('delegate assembly group eligibility', () => {
  it('rejects a missing group', () => {
    expect(canCreateDelegateAssemblyForGroup(undefined)).toBe(false);
  });

  it('falls back to the explicit hierarchy type when child metadata is absent', () => {
    expect(canCreateDelegateAssemblyForGroup({ group_type: 'hierarchical' })).toBe(true);
    expect(canCreateDelegateAssemblyForGroup({ group_type: 'base' })).toBe(false);
  });

  it('allows hierarchy groups with lower hierarchy children', () => {
    expect(
      canCreateDelegateAssemblyForGroup({
        group_type: 'hierarchical',
        has_hierarchy_children: true,
      })
    ).toBe(true);
  });

  it('allows mixed hierarchy and sibling groups when they have lower hierarchy children', () => {
    expect(
      canCreateDelegateAssemblyForGroup({
        group_type: 'hierarchical',
        has_hierarchy_children: true,
        has_sibling_connections: true,
      })
    ).toBe(true);
  });

  it('rejects elected or parliament sibling-only groups', () => {
    expect(
      canCreateDelegateAssemblyForGroup({
        group_type: 'sibling',
        has_hierarchy_children: false,
      })
    ).toBe(false);
  });
});
