import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type { AmendmentForwardingPreviewModel } from '../logic/amendmentForwardingPreview';

interface AmendmentForwardingNoticeProps {
  preview: AmendmentForwardingPreviewModel;
  className?: string;
}

const statusClasses = {
  pending:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  forwarded:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  rejected:
    'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  tie: 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
} satisfies Record<AmendmentForwardingPreviewModel['status'], string>;

function ForwardingStatusIcon({ status }: { status: AmendmentForwardingPreviewModel['status'] }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  if (status === 'forwarded') return <CheckCircle2 className={className} />;
  if (status === 'rejected') return <XCircle className={className} />;
  if (status === 'tie') return <AlertTriangle className={className} />;
  return <ArrowRight className={className} />;
}

export function AmendmentForwardingNotice({ preview, className }: AmendmentForwardingNoticeProps) {
  const { t } = useTranslation();
  const prefixKey =
    preview.status === 'forwarded'
      ? 'features.events.agenda.forwarding.completedPrefix'
      : preview.status === 'rejected'
        ? 'features.events.agenda.forwarding.rejectedPrefix'
        : preview.status === 'tie'
          ? 'features.events.agenda.forwarding.tiePrefix'
          : 'features.events.agenda.forwarding.pendingPrefix';
  const suffixKey =
    preview.status === 'forwarded'
      ? 'features.events.agenda.forwarding.completedSuffix'
      : preview.status === 'rejected'
        ? 'features.events.agenda.forwarding.rejectedSuffix'
        : preview.status === 'tie'
          ? 'features.events.agenda.forwarding.tieSuffix'
          : 'features.events.agenda.forwarding.pendingSuffix';

  return (
    <div
      data-forwarding-status={preview.status}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        statusClasses[preview.status],
        className
      )}
    >
      <ForwardingStatusIcon status={preview.status} />
      <span>
        {t(prefixKey)}{' '}
        {preview.nextEventId ? (
          <Link
            to="/event/$id/agenda"
            params={{ id: preview.nextEventId }}
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            {preview.nextEventTitle}
          </Link>
        ) : (
          <span className="font-medium">{preview.nextEventTitle}</span>
        )}
        {t(suffixKey)}
      </span>
    </div>
  );
}
