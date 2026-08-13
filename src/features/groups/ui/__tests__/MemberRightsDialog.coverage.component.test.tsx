/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { MemberRightsDialog } from '../MemberRightsDialog';

afterEach(cleanup);

describe('MemberRightsDialog branches', () => {
  it('renders membership absence, default labels, neutral count, and no profile action', () => {
    render(
      <MemberRightsDialog
        isOpen
        onOpenChange={vi.fn()}
        membership={null}
        onNavigateToUser={vi.fn()}
      />
    );
    expect(
      document.querySelector('[data-action-id="groups.member-rights.open.profile"]')
    ).toBeNull();
    expect(document.body.textContent).toContain('unknownUser');
  });

  it('renders custom labels, event tone, fallback role name, direct/implied sources and profile action', () => {
    const navigate = vi.fn();
    const membership = {
      id: 'm',
      user: { id: 'u', first_name: '', last_name: '' },
      roles: [
        {
          id: 'role',
          name: '',
          action_rights: [
            { resource: 'groups', action: 'view' },
            { resource: 'groupDocuments', action: 'view', implied_by: 'parent' },
          ],
        },
      ],
    } as any;
    render(
      <MemberRightsDialog
        isOpen
        onOpenChange={vi.fn()}
        membership={membership}
        onNavigateToUser={navigate}
        entityType="event"
        contextLabel="Context"
        fallbackRoleLabel="Member"
        profileButtonLabel="Profile"
        closeButtonLabel="Done"
        emptyRightsLabel="Empty"
      />
    );
    expect(document.body.textContent).toContain('roleFallback');
    const profile = screen.getByRole('button', { name: 'Profile' });
    fireEvent.click(profile);
    expect(navigate).toHaveBeenCalledWith('u');
  });
});
