import { Link } from '@tanstack/react-router';
import { ArrowRight, CalendarClock, Vote } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

interface AmendmentForwardingPreviewProps {
  nextEventId?: string | null;
  nextGroupName?: string | null;
  nextEventTitle: string;
  nextEventStartDate?: number | null;
  className?: string;
  compact?: boolean;
}

function formatForwardingDate(value?: number | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AmendmentForwardingPreview({
  nextEventId,
  nextGroupName,
  nextEventTitle,
  nextEventStartDate,
  className,
  compact = false,
}: AmendmentForwardingPreviewProps) {
  const { t } = useTranslation();
  const formattedDate = formatForwardingDate(nextEventStartDate);

  return (
    <div
      className={cn(
        'rounded-xl border border-pink-500/25 bg-pink-500/10',
        compact ? 'space-y-2 px-3 py-3 text-sm' : 'space-y-3 px-4 py-4',
        className
      )}
    >
      <div className="flex items-center gap-2 font-medium text-pink-950 dark:text-pink-100">
        <ArrowRight className="h-4 w-4" />
        <span>{t('features.amendments.process.forwardingPreviewTitle')}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-pink-700 dark:text-pink-300" />
          <div>
            {nextEventId ? (
              <Link
                to="/event/$id/agenda"
                params={{ id: nextEventId }}
                className="font-medium hover:underline"
              >
                {nextEventTitle}
                {nextGroupName ? ` · ${nextGroupName}` : ''}
              </Link>
            ) : (
              <p className="font-medium">
                {nextEventTitle}
                {nextGroupName ? ` · ${nextGroupName}` : ''}
              </p>
            )}
            {formattedDate ? <p className="text-muted-foreground">{formattedDate}</p> : null}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Vote className="mt-0.5 h-4 w-4 shrink-0 text-pink-700 dark:text-pink-300" />
          <p className="text-muted-foreground">
            {t('features.amendments.process.forwardingPreviewDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}
