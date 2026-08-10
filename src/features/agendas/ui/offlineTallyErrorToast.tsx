import { Link } from '@tanstack/react-router';
import type { ExternalToast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const NO_VOTING_PASSWORD_ERROR = 'No voting password set. Please set your voting PIN first.';
const INVALID_VOTING_PASSWORD_ERROR = 'Invalid voting password.';

export function isOfflineTallyPasswordError(message: string) {
  return message === INVALID_VOTING_PASSWORD_ERROR || message === NO_VOTING_PASSWORD_ERROR;
}

function buildNoVotingPasswordDescription(message: string, userId?: string | null) {
  const settingsHref = userId ? `/user/${userId}/settings?tab=passwords` : null;

  if (!settingsHref) {
    return `${message} ${translateText('common.votingPassword.missingSettingsSuffix')}`;
  }

  return (
    <span>
      {message} {translateText('common.votingPassword.missingSettingsPrefix')}{' '}
      <Link
        data-action-id="agendas.offline-tally.password-settings.navigate"
        data-action-kind="navigation"
        to={settingsHref}
        className="font-medium underline underline-offset-4"
      >
        {translateText('common.votingPassword.settingsLink')}
      </Link>{' '}
      {translateText('common.votingPassword.continueSuffix')}
    </span>
  );
}

export function buildOfflineTallyErrorToast({
  message,
  userId,
  action,
}: {
  message: string;
  userId?: string | null;
  action?: ExternalToast['action'];
}): ExternalToast {
  return {
    description:
      message === NO_VOTING_PASSWORD_ERROR
        ? buildNoVotingPasswordDescription(message, userId)
        : message,
    action,
  };
}
