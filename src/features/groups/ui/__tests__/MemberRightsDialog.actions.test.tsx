/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberRightsDialog } from '../MemberRightsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      (typeof fallback === 'string' ? fallback : fallback?.defaultValue) ?? key,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('MemberRightsDialog actions', () => {
  it('opens the profile and closes through stable dialog actions', () => {
    const onNavigateToUser = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MemberRightsDialog
        isOpen
        onOpenChange={onOpenChange}
        membership={{
          id: 'membership-1',
          user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
          roles: [],
        }}
        onNavigateToUser={onNavigateToUser}
      />
    );

    const profile = document.querySelector<HTMLElement>(
      '[data-action-id="groups.member-rights.open.profile"]'
    )!;
    profile.focus();
    expect(document.activeElement).toBe(profile);
    fireEvent.click(profile);
    fireEvent.click(
      document.querySelector('[data-action-id="groups.member-rights.close.dialog"]')!
    );
    expect(onNavigateToUser).toHaveBeenCalledWith('user-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
