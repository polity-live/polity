'use client';

import {
  useCountdownTimerController,
  useEndedAgoController,
} from '../hooks/useCountdownTimerController';

import { CountdownTimerView, EndedAgoView } from './CountdownTimerView';

export interface CountdownTimerProps {
  endsAt: Date | string;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
  compactLabel?: string;
  onExpire?: () => void;
}

export function CountdownTimer({
  endsAt,
  className,
  showIcon = true,
  compact = false,
  compactLabel,
  onExpire,
}: CountdownTimerProps) {
  const controller = useCountdownTimerController({ endsAt, onExpire });

  return (
    <CountdownTimerView
      className={className}
      showIcon={showIcon}
      compact={compact}
      compactLabel={compactLabel}
      {...controller}
    />
  );
}

export function EndedAgo({ endedAt, className }: { endedAt: Date | string; className?: string }) {
  const controller = useEndedAgoController(endedAt);

  return <EndedAgoView className={className} {...controller} />;
}
