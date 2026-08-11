'use client';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { compactActionButtonClassName } from '@/features/shared/ui/layout/ActionBar';
import { cn } from '@/features/shared/utils/utils';

export type EntityType = 'group' | 'blog' | 'amendment' | 'event' | 'user';

interface SubscribeButtonProps {
  'data-action-id'?: string;
  entityType: EntityType;
  entityId: string;
  isSubscribed: boolean;
  isLoading?: boolean;
  onToggleSubscribe: () => void;
  className?: string;
  compactOnMobile?: boolean;
}

/**
 * Generic subscribe button for entities (group, blog, amendment, event, user).
 * Handles only display and click, not state.
 */
export function SubscribeButton({
  'data-action-id': actionId,
  isSubscribed,
  isLoading = false,
  onToggleSubscribe,
  className,
  compactOnMobile = false,
}: SubscribeButtonProps) {
  const { t } = useTranslation();
  const label = isSubscribed
    ? t('components.actionBar.unsubscribe')
    : t('components.actionBar.subscribe');

  return (
    <Button
      data-action-id={actionId}
      data-tutorial-anchor="subscribe"
      variant={isSubscribed ? 'outline' : 'default'}
      onClick={onToggleSubscribe}
      className={cn(compactOnMobile && compactActionButtonClassName, className)}
      disabled={isLoading}
      aria-label={label}
    >
      {isSubscribed ? (
        <>
          <BellOff className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
          {label}
        </>
      ) : (
        <>
          <Bell className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
          {label}
        </>
      )}
    </Button>
  );
}
