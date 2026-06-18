import { describe, expect, it } from 'vitest';

import { canCreateDelegateAssemblyForGroup } from '../delegateAssemblyEligibility';

describe('delegate assembly group eligibility', () => {
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
