/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildOfflineTallyErrorToast,
  isOfflineTallyPasswordError,
} from '../offlineTallyErrorToast';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('offline tally error toast', () => {
  it('links a missing voting password to the exact user settings deep link', () => {
    const toast = buildOfflineTallyErrorToast({
      message: 'No voting password set. Please set your voting PIN first.',
      userId: 'user-1',
    });

    const description =
      typeof toast.description === 'function' ? toast.description() : toast.description;
    render(<div>{description}</div>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('data-action-id')).toBe(
      'agendas.offline-tally.password-settings.navigate'
    );
    expect(link.getAttribute('href')).toBe('/user/user-1/settings?tab=passwords');
  });

  it('classifies password errors without changing unrelated service failures', () => {
    expect(isOfflineTallyPasswordError('Invalid voting password.')).toBe(true);
    expect(
      isOfflineTallyPasswordError('No voting password set. Please set your voting PIN first.')
    ).toBe(true);
    expect(isOfflineTallyPasswordError('Database unavailable')).toBe(false);
    expect(buildOfflineTallyErrorToast({ message: 'Database unavailable' }).description).toBe(
      'Database unavailable'
    );
  });

  it('adds a settings hint when the user settings link is unavailable', () => {
    const toast = buildOfflineTallyErrorToast({
      message: 'No voting password set. Please set your voting PIN first.',
      userId: null,
    });

    expect(toast.description).toBe(
      'No voting password set. Please set your voting PIN first. common.votingPassword.missingSettingsSuffix'
    );
  });
});
