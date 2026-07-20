'use client';

import type { ComponentType } from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SemanticBadge, type BadgeTone } from './StatusBadges';

export type DocsSignalTone =
  'entry' | 'action' | 'collaboration' | 'attention' | 'decision' | 'result';

const docsSignalToneMap: Record<DocsSignalTone, BadgeTone> = {
  entry: 'info',
  action: 'warning',
  collaboration: 'accent',
  attention: 'destructive',
  decision: 'success',
  result: 'neutral',
};

export function DocsSignalBadge({ tone, className }: { tone: DocsSignalTone; className?: string }) {
  const { t } = useTranslation();

  return (
    <SemanticBadge
      status={tone}
      tone={docsSignalToneMap[tone]}
      label={t(`pages.docs.tones.${tone}`)}
      className={className}
    />
  );
}

type SupportStatus = 'active' | 'pending' | 'declined';

const supporterStatusConfig: Record<
  SupportStatus,
  {
    icon: ComponentType<{ className?: string }>;
    tone: BadgeTone;
  }
> = {
  active: {
    icon: CheckCircle,
    tone: 'success',
  },
  pending: {
    icon: Clock,
    tone: 'warning',
  },
  declined: {
    icon: XCircle,
    tone: 'destructive',
  },
};

export function SupporterStatusBadge({
  status,
  className,
  showIcon = true,
  size = 'md',
}: {
  status: SupportStatus;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const config = supporterStatusConfig[status];

  const statusLabels: Record<SupportStatus, string> = {
    active: t('features.amendments.supportConfirmation.comparison.currentLabel'),
    pending: t('features.amendments.supportConfirmation.pending'),
    declined: t('common.declined'),
  };

  return (
    <SemanticBadge
      status={status}
      tone={config.tone}
      label={statusLabels[status]}
      Icon={showIcon ? config.icon : undefined}
      size={size === 'sm' ? 'xs' : 'sm'}
      uppercase={false}
      className={className}
    />
  );
}
