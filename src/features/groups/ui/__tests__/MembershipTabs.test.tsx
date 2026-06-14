/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipTabs } from '../MembershipTabs';
import type { MembershipTab } from '../../types/group.types';

const defaultProps = {
  activeTab: 'membershipsByUser' as MembershipTab,
  onTabChange: vi.fn(),
  membershipsByUserContent: <div>Users content</div>,
  membershipsByRoleContent: <div>Roles content</div>,
  rolesContent: <div>Role settings</div>,
};

afterEach(() => {
  cleanup();
});

describe('MembershipTabs', () => {
  it('shows the rights alignment tab when hierarchical-group callers enable it', () => {
    render(
      <MembershipTabs
        {...defaultProps}
        activeTab="rightsAlignment"
        showRightsAlignment
        rightsAlignmentLabel="Rights alignment"
        rightsAlignmentContent={<div>Alignment content</div>}
      />
    );

    expect(screen.getByRole('tab', { name: 'Rights alignment' })).toBeTruthy();
    expect(screen.getByText('Alignment content')).toBeTruthy();
  });

  it('hides the rights alignment tab for base and sibling group callers', () => {
    render(<MembershipTabs {...defaultProps} rightsAlignmentLabel="Rights alignment" />);

    expect(screen.queryByRole('tab', { name: 'Rights alignment' })).toBeNull();
  });
});
