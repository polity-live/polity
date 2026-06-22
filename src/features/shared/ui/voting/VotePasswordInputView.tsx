import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react';

import { Link } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FormControlInput } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';

const NO_VOTING_PASSWORD_ERROR = 'No voting password set. Please set your voting PIN first.';

interface VotePasswordInputViewProps {
  digits: string[];
  inputRefs: RefObject<(HTMLInputElement | null)[]>;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent) => void;
  error?: string | null;
  noVotingPasswordSettingsHref?: string;
  isLoading?: boolean;
  className?: string;
}

export function VotePasswordInputView({
  digits,
  inputRefs,
  onChange,
  onKeyDown,
  onPaste,
  error,
  noVotingPasswordSettingsHref,
  isLoading,
  className,
}: VotePasswordInputViewProps) {
  const { t } = useTranslation();
  const showNoVotingPasswordLink =
    error === NO_VOTING_PASSWORD_ERROR && Boolean(noVotingPasswordSettingsHref);

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-muted-foreground text-center text-sm">
        {t('features.events.voting.enterPin')}
      </p>
      <div className="flex justify-center gap-3" onPaste={onPaste}>
        {digits.map((digit: any, index: number) => (
          <FormControlInput
            key={index}
            ref={element => {
              inputRefs.current[index] = element;
            }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={event => onChange(index, event.target.value)}
            onKeyDown={event => onKeyDown(index, event)}
            disabled={isLoading}
            className={cn('h-14 w-14 text-center text-2xl', error && 'border-destructive')}
            autoComplete="off"
          />
        ))}
      </div>
      {error ? (
        <p className="text-destructive text-center text-sm">
          {error}
          {showNoVotingPasswordLink ? (
            <>
              {' '}
              Set one in your{' '}
              <Link
                to={noVotingPasswordSettingsHref}
                className="font-medium underline underline-offset-4"
              >
                password settings
              </Link>{' '}
              to continue.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
