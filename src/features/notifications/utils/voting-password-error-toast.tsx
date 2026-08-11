import { Link } from '@tanstack/react-router';
import { gatedToast as toast } from './gated-toast';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { encodeAppError, localizeAppError, parseAppError } from '@/features/shared/errors';

// Kept exclusively for decoding errors emitted by older clients/server versions.
export const NO_VOTING_PASSWORD_ERROR = 'No voting password set. Please set your voting PIN first.';

const MISSING_VOTING_PASSWORD_TOAST_ID = 'missing-voting-password';
const INVALID_VOTING_PASSWORD_TOAST_ID = 'invalid-voting-password';

export function isVotingPasswordError(value: unknown) {
  const code = parseAppError(value)?.code;
  const message = value instanceof Error ? value.message : value;
  return (
    code === 'voting_password_missing' ||
    code === 'voting_password_invalid' ||
    message === NO_VOTING_PASSWORD_ERROR ||
    message === 'Invalid voting password.'
  );
}

export function showVotingPasswordErrorToast(value: unknown, userId?: string | null) {
  const payload = parseAppError(value);
  const message = value instanceof Error ? value.message : value;
  const isMissingPassword =
    payload?.code === 'voting_password_missing' || message === NO_VOTING_PASSWORD_ERROR;
  const localizedMessage = payload
    ? localizeAppError(payload)
    : localizeAppError(
        encodeAppError(isMissingPassword ? 'voting_password_missing' : 'voting_password_invalid')
      );
  const settingsHref = userId ? `/user/${userId}/settings?tab=passwords` : null;

  return toast.error(localizedMessage, {
    id: isMissingPassword ? MISSING_VOTING_PASSWORD_TOAST_ID : INVALID_VOTING_PASSWORD_TOAST_ID,
    description:
      isMissingPassword && settingsHref ? (
        <Link
          data-action-id="notifications.voting-pin.navigate.settings"
          to={settingsHref}
          className="pointer-events-auto cursor-pointer font-medium underline underline-offset-4 select-text"
          onPointerDown={event => event.stopPropagation()}
        >
          {translateText('common.votingPassword.openSettings')}
        </Link>
      ) : undefined,
  });
}
