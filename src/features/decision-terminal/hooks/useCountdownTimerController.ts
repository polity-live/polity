import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatCountdownTime, formatTimeElapsed } from '../logic/formatTimeUtils';

function calculateTimeRemaining(endsAt: Date): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
} {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds, isExpired: false };
}

function getUrgencyLevel(totalSeconds: number): 'normal' | 'closing' | 'urgent' | 'critical' {
  if (totalSeconds <= 0) return 'normal';
  if (totalSeconds <= 15 * 60) return 'critical';
  if (totalSeconds <= 60 * 60) return 'urgent';
  if (totalSeconds <= 24 * 60 * 60) return 'closing';
  return 'normal';
}

export function useCountdownTimerController(args: {
  endsAt: Date | string;
  onExpire?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState(() =>
    calculateTimeRemaining(new Date(args.endsAt))
  );

  const updateTime = useCallback(() => {
    const remaining = calculateTimeRemaining(new Date(args.endsAt));
    setTimeRemaining(remaining);

    if (remaining.isExpired && args.onExpire) {
      args.onExpire();
    }
  }, [args.endsAt, args.onExpire]);

  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  const locale = i18n.language === 'de' ? 'de' : 'en';
  const formattedTime = formatCountdownTime(
    timeRemaining.hours,
    timeRemaining.minutes,
    timeRemaining.seconds,
    { locale }
  );

  return {
    timeRemaining,
    formattedTime,
    urgency: getUrgencyLevel(timeRemaining.totalSeconds),
    labels: {
      ended: t('features.timeline.terminal.ended'),
    },
  };
}

export function useEndedAgoController(endedAt: Date | string) {
  const { t, i18n } = useTranslation();
  const [, setTick] = useState(0);

  const locale = i18n.language === 'de' ? 'de' : 'en';
  const timeString = formatTimeElapsed(endedAt, { locale });

  useEffect(() => {
    const interval = setInterval(() => setTick(tick => tick + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    timeString,
    label: timeString ? t('features.timeline.terminal.endedAgo', { time: timeString }) : null,
  };
}
