import { Link } from '@tanstack/react-router';
import { gatedToast as toast } from './gated-toast';

export const NO_VOTING_PASSWORD_ERROR = 'No voting password set. Please set your voting PIN first.';

const MISSING_VOTING_PASSWORD_TOAST_ID = 'missing-voting-password';
const INVALID_VOTING_PASSWORD_TOAST_ID = 'invalid-voting-password';

export function isVotingPasswordError(message: string) {
  return message === NO_VOTING_PASSWORD_ERROR || message === 'Invalid voting password.';
}

export function showVotingPasswordErrorToast(message: string, userId?: string | null) {
  const isMissingPassword = message === NO_VOTING_PASSWORD_ERROR;
  const settingsHref = userId ? `/user/${userId}/settings?tab=passwords` : null;

  return toast.error(message, {
    id: isMissingPassword ? MISSING_VOTING_PASSWORD_TOAST_ID : INVALID_VOTING_PASSWORD_TOAST_ID,
    description:
      isMissingPassword && settingsHref ? (
        <Link
          to={settingsHref}
          className="pointer-events-auto cursor-pointer font-medium underline underline-offset-4 select-text"
          onPointerDown={event => event.stopPropagation()}
        >
          Open password settings
        </Link>
      ) : undefined,
  });
}
