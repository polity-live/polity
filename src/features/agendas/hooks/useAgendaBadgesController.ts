import { useEffect, useMemo, useState } from 'react';

import type { BadgeTone } from '@/features/shared/ui/status';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  getElectionModeSummaryLabel,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import type { AgendaItemStatus, AgendaItemType } from '@/features/agendas/ui/AgendaCard';
import { Building2, FileText, ScrollText, ShieldCheck, UserCheck, Users, Vote } from 'lucide-react';

type AgendaVisualStatus = AgendaItemStatus | 'active';

export type AgendaCountdownTone = 'start' | 'active' | 'end' | 'completed';

export function getCountdownTone(tone: AgendaCountdownTone): BadgeTone {
  switch (tone) {
    case 'start':
      return 'warning';
    case 'active':
      return 'success';
    case 'completed':
      return 'neutral';
    case 'end':
    default:
      return 'info';
  }
}

export function useAgendaStatusBadgeController(status: AgendaVisualStatus) {
  const { t } = useTranslation();

  switch (status) {
    case 'active':
    case 'in-progress':
      return {
        status,
        label: t('features.events.agenda.active'),
        leading: '🟢',
        tone: 'success' as BadgeTone,
        pulse: status === 'active',
      };
    case 'completed':
      return {
        status,
        label: t('features.events.agenda.statusCompleted'),
        leading: '✅',
        tone: 'info' as BadgeTone,
        pulse: false,
      };
    case 'pending':
      return {
        status,
        label: t('features.events.agenda.statusPending'),
        leading: '⚪',
        tone: 'neutral' as BadgeTone,
        pulse: false,
      };
    case 'planned':
    default:
      return {
        status,
        label: t('features.events.agenda.statusPlanned'),
        leading: '🟡',
        tone: 'warning' as BadgeTone,
        pulse: false,
      };
  }
}

export function useAgendaTypeBadgeController(type: AgendaItemType) {
  const { t } = useTranslation();

  switch (type) {
    case 'election':
      return {
        status: type,
        label: t('features.events.agenda.typeElection'),
        Icon: UserCheck,
        tone: 'destructive' as BadgeTone,
      };
    case 'vote':
      return {
        status: type,
        label: t('features.events.agenda.typeVote'),
        Icon: Vote,
        tone: 'warning' as BadgeTone,
      };
    case 'accreditation':
      return {
        status: type,
        label: t('features.events.agenda.typeAccreditation'),
        Icon: ShieldCheck,
        tone: 'success' as BadgeTone,
      };
    case 'speech':
      return {
        status: type,
        label: t('features.events.agenda.typeSpeech'),
        Icon: Users,
        tone: 'info' as BadgeTone,
      };
    case 'discussion':
    default:
      return {
        status: type,
        label: t('features.events.agenda.typeDiscussion'),
        Icon: FileText,
        tone: 'accent' as BadgeTone,
      };
  }
}

export function useAgendaElectionModeBadgeController(
  electionMode: ElectionMode,
  seatCount?: number | null
) {
  return {
    status: electionMode,
    tone: 'success' as BadgeTone,
    label: getElectionModeSummaryLabel(electionMode, seatCount),
  };
}

export function useAgendaEntityBadgeController(variant: 'amendment' | 'role') {
  return {
    status: variant,
    Icon: variant === 'amendment' ? ScrollText : Building2,
    tone: variant === 'amendment' ? ('info' as BadgeTone) : ('accent' as BadgeTone),
  };
}

export function useAgendaCountdownPillController(endsAt: Date | string) {
  const endTimestamp = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [isExpired, setIsExpired] = useState(() =>
    Number.isFinite(endTimestamp) ? endTimestamp <= Date.now() : true
  );

  useEffect(() => {
    if (!Number.isFinite(endTimestamp)) {
      setIsExpired(true);
      return;
    }

    const updateExpiredState = () => setIsExpired(endTimestamp <= Date.now());
    updateExpiredState();

    if (endTimestamp <= Date.now()) {
      return;
    }

    const interval = setInterval(updateExpiredState, 1000);
    return () => clearInterval(interval);
  }, [endTimestamp]);

  return {
    isExpired,
  };
}

export function useAgendaEndedPillController(endedAt: Date | string) {
  const endTimestamp = new Date(endedAt).getTime();

  return {
    shouldRender: Number.isFinite(endTimestamp) && endTimestamp <= Date.now(),
  };
}
