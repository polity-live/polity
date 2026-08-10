/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ParticipationTabs } from '../MembershipTabs';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/form', () => ({
  SettingsTabs: ({ tabs, children, onValueChange, action }: any) => (
    <section>
      <div data-testid="tab-labels">{tabs.map((tab: any) => tab.label).join('|')}</div>
      <button onClick={() => onValueChange(tabs[0].value)}>Select first</button>
      {action}
      {children}
    </section>
  ),
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>,
}));

afterEach(() => cleanup());

const baseProps = {
  activeTab: 'membershipsByUser' as const,
  onTabChange: vi.fn(),
  membershipsByUserContent: <span>User memberships</span>,
  membershipsByRoleContent: <span>Role memberships</span>,
  rolesContent: <span>Roles content</span>,
};

describe('ParticipationTabs', () => {
  it('renders the default membership, guest, and role tabs', () => {
    const onTabChange = vi.fn();
    render(
      <ParticipationTabs
        {...baseProps}
        onTabChange={onTabChange}
        guestsContent={<span>Guests content</span>}
        tabBarAction={<span>Tab action</span>}
      />
    );

    const labels = screen.getByTestId('tab-labels').textContent;
    expect(labels).toContain('translated:generated.inline.0097_memberships_by_user_6e8b52a5');
    expect(labels).toContain('translated:generated.inline.0098_memberships_by_role_b2e0e498');
    expect(labels).toContain('Guests');
    expect(labels).toContain('Roles');
    expect(screen.getByText('User memberships')).toBeTruthy();
    expect(screen.getByText('Role memberships')).toBeTruthy();
    expect(screen.getByText('Guests content')).toBeTruthy();
    expect(screen.getByText('Roles content')).toBeTruthy();
    expect(screen.queryByText('Composition content')).toBeNull();

    fireEvent.click(screen.getByText('Select first'));
    expect(onTabChange).toHaveBeenCalledWith('membershipsByUser');
  });

  it('renders the complementary optional tabs with custom labels', () => {
    render(
      <ParticipationTabs
        {...baseProps}
        activeTab="composition"
        showMembershipsByUser={false}
        showMembershipsByRole={false}
        showComposition
        showRightsAlignment
        showOpenAssignments
        showGuests={false}
        showRoles={false}
        compositionContent={<span>Composition content</span>}
        rightsAlignmentContent={<span>Rights content</span>}
        openAssignmentsContent={<span>Assignments content</span>}
        membershipsByUserLabel="People"
        membershipsByRoleLabel="Functions"
        compositionLabel="Composition"
        rightsAlignmentLabel="Rights"
        openAssignmentsLabel="Open roles"
        guestsLabel="Visitors"
        rolesLabel="Roles custom"
      />
    );

    expect(screen.getByTestId('tab-labels').textContent).toBe('Composition|Rights|Open roles');
    expect(screen.getByText('Composition content')).toBeTruthy();
    expect(screen.getByText('Rights content')).toBeTruthy();
    expect(screen.getByText('Assignments content')).toBeTruthy();
    expect(screen.queryByText('User memberships')).toBeNull();
    expect(screen.queryByText('Role memberships')).toBeNull();
    expect(screen.queryByText('Roles content')).toBeNull();
  });
});
