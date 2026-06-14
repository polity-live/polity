import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export const RIGHT_TYPES = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
] as const;

export type RightType = (typeof RIGHT_TYPES)[number];

const RIGHT_TRANSLATION_KEYS: Record<RightType, string> = {
  informationRight: 'common.rights.information',
  amendmentRight: 'common.rights.amendment',
  rightToSpeak: 'common.rights.speak',
  activeVotingRight: 'common.rights.activeVoting',
  passiveVotingRight: 'common.rights.passiveVoting',
};

export const RIGHT_LABELS: Record<RightType, string> = {
  informationRight: 'Info',
  amendmentRight: 'Antrag',
  rightToSpeak: 'Rede',
  activeVotingRight: 'Aktiv',
  passiveVotingRight: 'Passiv',
};

export const RIGHT_GRADIENTS: Record<string, string> = {
  informationRight:
    'bg-gradient-to-r from-blue-500 to-cyan-400 dark:from-blue-700 dark:to-cyan-600',
  amendmentRight:
    'bg-gradient-to-r from-violet-500 to-purple-400 dark:from-violet-700 dark:to-purple-600',
  rightToSpeak:
    'bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-700 dark:to-emerald-600',
  activeVotingRight:
    'bg-gradient-to-r from-orange-500 to-red-400 dark:from-orange-700 dark:to-red-600',
  passiveVotingRight:
    'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-700 dark:to-rose-600',
};

type RightRequestKind = 'incoming' | 'outgoing';
type RightLabelTranslateFn = (key: string, fallback?: string) => string;

export function isRightType(right: string): right is RightType {
  return RIGHT_TYPES.includes(right as RightType);
}

export function getRightLabel(right: string, t?: RightLabelTranslateFn): string {
  if (!isRightType(right)) {
    return right;
  }

  const fallback = RIGHT_LABELS[right];
  if (!t) {
    return fallback;
  }

  return t(RIGHT_TRANSLATION_KEYS[right], fallback) || fallback;
}

export function formatRights(rights: string[], t?: RightLabelTranslateFn): string {
  return rights.map(right => getRightLabel(right, t)).join(', ');
}

export function isEdgeVisible(edgeRights: string[], selectedRights: Set<string>): boolean {
  return edgeRights.some(right => selectedRights.has(right));
}

export function RightBadgeVisual({
  right,
  label,
  variant = 'gradient',
  size = 'default',
  className,
  requestKind,
  requestStatusLabel,
}: {
  right: string;
  label: ReactNode;
  variant?: 'gradient' | 'outline';
  size?: 'default' | 'compact';
  className?: string;
  requestKind?: RightRequestKind | null;
  requestStatusLabel?: string | null;
}) {
  const RequestIcon = requestKind === 'incoming' ? ArrowDownLeft : ArrowUpRight;
  const badge =
    variant === 'outline' ? (
      <BadgeControl
        variant="outline"
        className={cn(
          size === 'compact' ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'text-xs',
          className
        )}
      >
        {label}
      </BadgeControl>
    ) : (
      <BadgeControl
        className={cn(
          'border-0 text-xs text-white',
          size === 'compact' && 'px-1.5 py-0.5 text-[10px] leading-tight',
          RIGHT_GRADIENTS[right] ?? 'bg-muted text-muted-foreground',
          className
        )}
      >
        {label}
      </BadgeControl>
    );

  return (
    <span className="relative inline-flex shrink-0 overflow-visible align-middle">
      {badge}
      {requestKind && requestStatusLabel ? (
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
      ) : null}
    </span>
  );
}

export function RightBadge({
  right,
  variant = 'gradient',
  className,
  size = 'default',
  requestKind,
}: {
  right: string;
  variant?: 'gradient' | 'outline';
  className?: string;
  size?: 'default' | 'compact';
  requestKind?: RightRequestKind | null;
}) {
  const { t } = useTranslation();
  const label = getRightLabel(right, (key, fallback) => t(key) || fallback || key);
  const requestStatusLabel =
    requestKind === 'incoming'
      ? t('common.network.incomingRequest')
      : requestKind === 'outgoing'
        ? t('common.network.outgoingRequest')
        : null;

  return (
    <RightBadgeVisual
      right={right}
      label={label}
      variant={variant}
      size={size}
      className={className}
      requestKind={requestKind}
      requestStatusLabel={requestStatusLabel}
    />
  );
}

export function RightFilterOptionButton({
  active,
  right,
  children,
  onClick,
}: {
  active: boolean;
  right: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      className={cn(
        'text-xs',
        active
          ? `${RIGHT_GRADIENTS[right] ?? 'bg-primary'} border-0 text-white hover:text-white`
          : 'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground'
      )}
    >
      {children}
    </Button>
  );
}
