import type { ComponentType } from 'react';

import { Link } from '@tanstack/react-router';

import { featureThemeClassName } from '@/features/shared/theme';
import { SemanticBadge, StatusPillFrame, type BadgeTone } from '@/features/shared/ui/status';
import { CountdownTimer, EndedAgo } from '@/features/decision-terminal/ui/CountdownTimer';

import { getCountdownTone, type AgendaCountdownTone } from '../hooks/useAgendaBadgesController';

interface AgendaSemanticBadgeViewProps {
  status: string;
  tone: BadgeTone;
  label: string;
  className?: string;
  leading?: string;
  Icon?: ComponentType<{ className?: string }>;
  pulse?: boolean;
}

export function AgendaSemanticBadgeView({
  status,
  tone,
  label,
  className,
  leading,
  Icon,
  pulse,
}: AgendaSemanticBadgeViewProps) {
  return (
    <SemanticBadge
      status={status}
      tone={tone}
      label={label}
      leading={leading}
      Icon={Icon}
      className={className}
      pulse={pulse}
    />
  );
}

export function AgendaEntityBadgeView({
  label,
  href,
  className,
  status,
  tone,
  Icon,
}: {
  label: string;
  href: string;
  className?: string;
  status: string;
  tone: BadgeTone;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link to={href} onClick={e => e.stopPropagation()}>
      <SemanticBadge status={status} tone={tone} label={label} Icon={Icon} className={className} />
    </Link>
  );
}

export function AgendaCountdownPillView({
  label,
  endsAt,
  tone,
  className,
  isExpired,
}: {
  label: string;
  endsAt: Date | string;
  tone: AgendaCountdownTone;
  className?: string;
  isExpired: boolean;
}) {
  if (isExpired) {
    return null;
  }

  return (
    <StatusPillFrame tone={getCountdownTone(tone)} className={className}>
      <CountdownTimer endsAt={endsAt} compact showIcon={false} compactLabel={label} />
    </StatusPillFrame>
  );
}

export function AgendaEndedPillView({
  endedAt,
  className,
  shouldRender,
}: {
  endedAt: Date | string;
  className?: string;
  shouldRender: boolean;
}) {
  if (!shouldRender) {
    return null;
  }

  return (
    <StatusPillFrame tone="neutral" className={className}>
      <EndedAgo
        endedAt={endedAt}
        className={featureThemeClassName('agendaAgendaBadgesThemedText')}
      />
    </StatusPillFrame>
  );
}
