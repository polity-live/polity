import { BadgeControl } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';
import { getRightLabel, RIGHT_GRADIENTS, type RightType } from '@/features/network/ui/RightFilters';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';

type RightRequestKind = Extract<NetworkRelationshipKind, 'incoming' | 'outgoing'>;

interface RightBadgeProps {
  right: string;
  variant?: 'gradient' | 'outline';
  className?: string;
  requestKind?: RightRequestKind | null;
}

export function RightBadge({
  right,
  variant = 'gradient',
  className,
  requestKind,
}: RightBadgeProps) {
  const { t } = useTranslation();
  const label = getRightLabel(right, (key, fallback) => t(key) || fallback || key);
  const requestStatusLabel =
    requestKind === translateText('generated.inline.0124_incoming_2ff8dd80')
      ? t('common.network.incomingRequest')
      : requestKind === translateText('generated.inline.0125_outgoing_708a91a8')
        ? t('common.network.outgoingRequest')
        : null;
  const RequestIcon = requestKind === 'incoming' ? ArrowDownLeft : ArrowUpRight;

  if (variant === 'outline') {
    return (
      <span className="relative inline-flex shrink-0 overflow-visible align-middle">
        <BadgeControl variant="outline" className={cn('text-xs', className)}>
          {label}
        </BadgeControl>
        {requestKind && requestStatusLabel && (
          <span
            className={cn(
              'border-background absolute -top-1 -right-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border text-white shadow-sm',
              requestKind === 'incoming' ? 'bg-blue-500' : 'bg-amber-500'
            )}
            aria-label={requestStatusLabel}
            title={requestStatusLabel}
          >
            <RequestIcon className="h-2 w-2" />
          </span>
        )}
      </span>
    );
  }

  const gradient = RIGHT_GRADIENTS[right as RightType];

  return (
    <span className="relative inline-flex shrink-0 overflow-visible align-middle">
      <BadgeControl
        className={cn(
          'border-0 text-xs text-white',
          gradient ?? 'bg-muted text-muted-foreground',
          className
        )}
      >
        {label}
      </BadgeControl>
      {requestKind && requestStatusLabel && (
        <span
          className={cn(
            'border-background absolute -top-1 -right-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border text-white shadow-sm',
            requestKind === 'incoming' ? 'bg-blue-500' : 'bg-amber-500'
          )}
          aria-label={requestStatusLabel}
          title={requestStatusLabel}
        >
          <RequestIcon className="h-2 w-2" />
        </span>
      )}
    </span>
  );
}
