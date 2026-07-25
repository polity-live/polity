'use client';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';

interface DiscussionTimestampProps {
  value: string | number | Date | null | undefined;
  className?: string;
}

function relativeTimeParts(date: Date, now: number) {
  const seconds = (date.getTime() - now) / 1_000;
  const absoluteSeconds = Math.abs(seconds);

  if (absoluteSeconds < 60) return { value: Math.round(seconds), unit: 'second' as const };
  if (absoluteSeconds < 3_600) {
    return { value: Math.round(seconds / 60), unit: 'minute' as const };
  }
  if (absoluteSeconds < 86_400) {
    return { value: Math.round(seconds / 3_600), unit: 'hour' as const };
  }
  if (absoluteSeconds < 2_592_000) {
    return { value: Math.round(seconds / 86_400), unit: 'day' as const };
  }
  if (absoluteSeconds < 31_536_000) {
    return { value: Math.round(seconds / 2_592_000), unit: 'month' as const };
  }
  return { value: Math.round(seconds / 31_536_000), unit: 'year' as const };
}

export function DiscussionTimestamp({ value, className }: DiscussionTimestampProps) {
  const language = useLanguageStore(state => state.language);
  const date = value instanceof Date ? value : new Date(value ?? Number.NaN);

  if (!Number.isFinite(date.getTime())) return null;

  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const fullDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  const relative = relativeTimeParts(date, Date.now());
  const relativeDate = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'short',
  }).format(relative.value, relative.unit);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={date.toISOString()}
          aria-label={fullDate}
          tabIndex={0}
          className={cn(
            'focus-visible:ring-ring shrink-0 rounded-sm text-xs whitespace-nowrap outline-none focus-visible:ring-2',
            className
          )}
        >
          {relativeDate}
        </time>
      </TooltipTrigger>
      <TooltipContent>{fullDate}</TooltipContent>
    </Tooltip>
  );
}
