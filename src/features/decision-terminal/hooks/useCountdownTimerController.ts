import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

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

function formatTime(hours: number, minutes: number, seconds: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${pad(remainingHours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getUrgencyLevel(totalSeconds: number): 'normal' | 'closing' | 'urgent' | 'critical' {
  if (totalSeconds <= 0) return 'normal';
  if (totalSeconds <= 15 * 60) return 'critical';
  if (totalSeconds <= 60 * 60) return 'urgent';
  if (totalSeconds <= 24 * 60 * 60) return 'closing';
  return 'normal';
}

function formatEndedAgo(endedAt: Date | string) {
  const end = new Date(endedAt);
  const now = new Date();
  const diffMs = now.getTime() - end.getTime();

  if (diffMs < 0) {
    return null;
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  }

  if (diffHours > 0) {
    return `${diffHours}h`;
  }

  return `${diffMins}m`;
}

export function useCountdownTimerController(args: {
  endsAt: Date | string;
  onExpire?: () => void;
}) {
  const { t } = useTranslation();
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

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining.hours, timeRemaining.minutes, timeRemaining.seconds),
    urgency: getUrgencyLevel(timeRemaining.totalSeconds),
    labels: {
      ended: t('timeline.terminal.ended'),
    },
  };
}

export function useEndedAgoController(endedAt: Date | string) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  const timeString = formatEndedAgo(endedAt);

  useEffect(() => {
    const interval = setInterval(() => setTick(tick => tick + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    timeString,
    label: timeString ? t('timeline.terminal.endedAgo', { time: timeString }) : null,
  };
}
