import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('../gated-toast', () => ({
  gatedToast: { error: toastError },
}));

import {
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
    expect(message).toBe(NO_VOTING_PASSWORD_ERROR);
    expect(options.id).toBe('missing-voting-password');
    expect(isValidElement(options.description)).toBe(true);
    expect((options.description as ReactElement<{ to: string }>).props.to).toBe(
      '/user/user-1/settings?tab=passwords'
    );
  });
});
