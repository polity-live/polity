import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('../gated-toast', () => ({
  gatedToast: { error: toastError },
}));

import {
  isVotingPasswordError,
  NO_VOTING_PASSWORD_ERROR,
  showVotingPasswordErrorToast,
} from '../voting-password-error-toast';

describe('showVotingPasswordErrorToast', () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it('shows the missing-PIN message once under a stable id with a settings link', () => {
    showVotingPasswordErrorToast(NO_VOTING_PASSWORD_ERROR, 'user-1');
    showVotingPasswordErrorToast(NO_VOTING_PASSWORD_ERROR, 'user-1');

    expect(toastError).toHaveBeenCalledTimes(2);
    const [message, options] = toastError.mock.calls[1];
    expect(message).toBe('Set a voting PIN before continuing.');
    expect(options.id).toBe('missing-voting-password');
    expect(isValidElement(options.description)).toBe(true);
    const link = options.description as ReactElement<{
      to: string;
      'data-action-id': string;
      onPointerDown?: (event: { stopPropagation: () => void }) => void;
    }>;
    expect(link.props.to).toBe('/user/user-1/settings?tab=passwords');
    expect(link.props['data-action-id']).toBe('notifications.voting-pin.navigate.settings');
    const stopPropagation = vi.fn();
    link.props.onPointerDown?.({ stopPropagation } as never);
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('recognizes structured and legacy missing and invalid password failures', () => {
    expect(isVotingPasswordError({ version: 1, code: 'voting_password_missing' })).toBe(true);
    expect(isVotingPasswordError({ version: 1, code: 'voting_password_invalid' })).toBe(true);
    expect(isVotingPasswordError(new Error(NO_VOTING_PASSWORD_ERROR))).toBe(true);
    expect(isVotingPasswordError('Invalid voting password.')).toBe(true);
    expect(isVotingPasswordError(new Error('different error'))).toBe(false);
    expect(isVotingPasswordError(null)).toBe(false);
  });

  it('uses invalid-password ids without linking when settings are unavailable', () => {
    showVotingPasswordErrorToast({ version: 1, code: 'voting_password_invalid' }, null);
    let [message, options] = toastError.mock.calls.at(-1)!;
    expect(message).toBe('The voting PIN is incorrect.');
    expect(options.id).toBe('invalid-voting-password');
    expect(options.description).toBeUndefined();

    showVotingPasswordErrorToast(new Error('Invalid voting password.'), 'user-1');
    [message, options] = toastError.mock.calls.at(-1)!;
    expect(message).toBe('The voting PIN is incorrect.');
    expect(options.id).toBe('invalid-voting-password');
    expect(options.description).toBeUndefined();
  });
});
