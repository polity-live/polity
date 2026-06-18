import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getRightToneClasses } from '@/features/shared/theme';
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
export const MEMBERSHIP_FLOW_RIGHT = 'membership' as const;
export const NETWORK_FLOW_FILTER_TYPES = [...RIGHT_TYPES, MEMBERSHIP_FLOW_RIGHT] as const;
export type NetworkFlowFilterType = (typeof NETWORK_FLOW_FILTER_TYPES)[number];

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
  informationRight: getRightToneClasses('informationRight').badge,
  amendmentRight: getRightToneClasses('amendmentRight').badge,
  rightToSpeak: getRightToneClasses('rightToSpeak').badge,
  activeVotingRight: getRightToneClasses('activeVotingRight').badge,
  passiveVotingRight: getRightToneClasses('passiveVotingRight').badge,
  [MEMBERSHIP_FLOW_RIGHT]:
    'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)] text-[var(--entity-group-fg)]',
};

export const TOKEN_BADGE_FILTER_HOVER_CLASSES = 'hover:bg-accent hover:text-accent-foreground';

type RightRequestKind = 'incoming' | 'outgoing';
type RightLabelTranslateFn = (key: string, fallback?: string) => string;

export function isRightType(right: string): right is RightType {
  return RIGHT_TYPES.includes(right as RightType);
}

export function getRightLabel(right: string, t?: RightLabelTranslateFn): string {
  if (right === MEMBERSHIP_FLOW_RIGHT) {
    const fallback = 'Membership';
    return t ? t('common.network.membershipLabel', fallback) || fallback : fallback;
  }

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
          'text-xs',
          size === 'compact' && 'px-1.5 py-0.5 text-[10px] leading-tight',
          RIGHT_GRADIENTS[right] ?? getRightToneClasses(right).badge,
          TOKEN_BADGE_FILTER_HOVER_CLASSES,
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
            'border-background absolute -top-1 -right-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border shadow-sm',
            requestKind === 'incoming'
              ? 'text-background bg-[var(--badge-info-fg)]'
              : 'text-background bg-[var(--badge-warning-fg)]'
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
          ? cn(
              RIGHT_GRADIENTS[right] ?? getRightToneClasses(right).badge,
              TOKEN_BADGE_FILTER_HOVER_CLASSES,
              'shadow-sm'
            )
          : 'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground'
      )}
    >
      {children}
    </Button>
  );
}
