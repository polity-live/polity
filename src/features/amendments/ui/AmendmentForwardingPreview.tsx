import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Vote,
  XCircle,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type { AmendmentForwardingStatus } from '../logic/amendmentForwardingPreview';

interface AmendmentForwardingPreviewProps {
  status?: AmendmentForwardingStatus;
  nextEventId?: string | null;
  nextGroupName?: string | null;
  nextEventTitle: string;
  nextEventStartDate?: number | null;
  className?: string;
  compact?: boolean;
}

const statusClasses = {
  pending:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  forwarded:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  rejected:
    'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  tie: 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
} satisfies Record<AmendmentForwardingStatus, string>;

function ForwardingStatusIcon({ status }: { status: AmendmentForwardingStatus }) {
  const className = 'h-4 w-4';
  if (status === 'forwarded') return <CheckCircle2 className={className} />;
  if (status === 'rejected') return <XCircle className={className} />;
  if (status === 'tie') return <AlertTriangle className={className} />;
  return <ArrowRight className={className} />;
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
  status = 'pending',
  nextEventId,
  nextGroupName,
  nextEventTitle,
  nextEventStartDate,
  className,
  compact = false,
}: AmendmentForwardingPreviewProps) {
  const { t } = useTranslation();
  const formattedDate = formatForwardingDate(nextEventStartDate);
  const titleKey =
    status === 'forwarded'
      ? 'features.amendments.process.forwardingCompletedTitle'
      : status === 'rejected'
        ? 'features.amendments.process.forwardingRejectedTitle'
        : status === 'tie'
          ? 'features.amendments.process.forwardingTieTitle'
          : 'features.amendments.process.forwardingPreviewTitle';
  const descriptionKey =
    status === 'forwarded'
      ? 'features.amendments.process.forwardingCompletedDescription'
      : status === 'rejected'
        ? 'features.amendments.process.forwardingRejectedDescription'
        : status === 'tie'
          ? 'features.amendments.process.forwardingTieDescription'
          : 'features.amendments.process.forwardingPreviewDescription';

  return (
    <div
      data-forwarding-status={status}
      className={cn(
        'rounded-xl border',
        statusClasses[status],
        compact ? 'space-y-2 px-3 py-3 text-sm' : 'space-y-3 px-4 py-4',
        className
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <ForwardingStatusIcon status={status} />
        <span>{t(titleKey)}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
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
          <Vote className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="opacity-80">{t(descriptionKey)}</p>
        </div>
      </div>
    </div>
  );
}
