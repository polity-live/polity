/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS } from '../groupEditMembershipModes';

describe('GroupEditFormView membership mode options', () => {
  it('offers exactly the three supported sibling membership modes', () => {
    const values = [...GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS] as string[];

    expect(values).toEqual(['none', 'all_members', 'role_members']);
    expect(values).not.toContain('selected_source_groups');
  });
});
