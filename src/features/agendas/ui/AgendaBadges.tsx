'use client';

import type { ElectionMode } from '@/features/elections/logic/electionMode';
import type { AgendaItemStatus, AgendaItemType } from './AgendaCard';

import {
  useAgendaCountdownPillController,
  useAgendaElectionModeBadgeController,
  useAgendaEndedPillController,
  useAgendaEntityBadgeController,
  useAgendaStatusBadgeController,
  useAgendaTypeBadgeController,
  type AgendaCountdownTone,
} from '../hooks/useAgendaBadgesController';
import {
  AgendaCountdownPillView,
  AgendaEndedPillView,
  AgendaEntityBadgeView,
  AgendaSemanticBadgeView,
} from './AgendaBadgesView';

type AgendaVisualStatus = AgendaItemStatus | 'active';

export function AgendaStatusBadge({
  status,
  className,
}: {
  status: AgendaVisualStatus;
  className?: string;
}) {
  const controller = useAgendaStatusBadgeController(status);

  return <AgendaSemanticBadgeView className={className} {...controller} />;
}

export function AgendaTypeBadge({ type, className }: { type: AgendaItemType; className?: string }) {
  const controller = useAgendaTypeBadgeController(type);

  return <AgendaSemanticBadgeView className={className} {...controller} />;
}

export function AgendaElectionModeBadge({
  electionMode,
  seatCount,
  className,
}: {
  electionMode: ElectionMode;
  seatCount?: number | null;
  className?: string;
}) {
  const controller = useAgendaElectionModeBadgeController(electionMode, seatCount);

  return <AgendaSemanticBadgeView className={className} {...controller} />;
}

export function AgendaEntityBadge({
  label,
  href,
  variant,
  className,
}: {
  label: string;
  href: string;
  variant: 'amendment' | 'role';
  className?: string;
}) {
  const controller = useAgendaEntityBadgeController(variant);

  return <AgendaEntityBadgeView label={label} href={href} className={className} {...controller} />;
}

export function AgendaCountdownPill({
  label,
  endsAt,
  tone = 'end',
  className,
}: {
  label: string;
  endsAt: Date | string;
  tone?: AgendaCountdownTone;
  className?: string;
}) {
  const controller = useAgendaCountdownPillController(endsAt);

  return (
    <AgendaCountdownPillView
      label={label}
      endsAt={endsAt}
      tone={tone}
      className={className}
      {...controller}
    />
  );
}

export function AgendaEndedPill({
  endedAt,
  className,
}: {
  endedAt: Date | string;
  className?: string;
}) {
  const controller = useAgendaEndedPillController(endedAt);

  return <AgendaEndedPillView endedAt={endedAt} className={className} {...controller} />;
}
