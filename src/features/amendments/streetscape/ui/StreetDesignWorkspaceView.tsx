import { AlertTriangle, MapPinned } from 'lucide-react';
import type { ReactNode } from 'react';
import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface StreetDesignWorkspaceViewProps {
  topBar?: ReactNode;
  beforeCard?: ReactNode;
  title: string;
  selectionAddressLabel: string;
  metricLabels: readonly string[];
  isDirty: boolean;
  collaborators?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  embedded?: boolean;
  contentOnly?: boolean;
  className?: string;
}

export function StreetDesignWorkspaceView({
  topBar,
  beforeCard,
  title,
  selectionAddressLabel,
  metricLabels,
  isDirty,
  collaborators,
  headerActions,
  children,
  embedded = false,
  contentOnly = false,
  className,
}: StreetDesignWorkspaceViewProps) {
  const { t } = useTranslation();

  const workspaceCard = (
    <Card className={cn('overflow-hidden rounded-lg p-0', beforeCard && 'mt-4')}>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded-md border">
            <MapPinned className="text-muted-foreground size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <CardTitle size="lg" className="truncate leading-tight">
                {title}
              </CardTitle>
              {collaborators}
            </div>
            <p className="text-muted-foreground mt-1 truncate text-xs">{selectionAddressLabel}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs">
          {metricLabels.map(label => (
            <span
              key={label}
              className="bg-muted/20 rounded-md border px-3 py-2 font-medium whitespace-nowrap"
            >
              {label}
            </span>
          ))}
          {isDirty ? (
            <BadgeControl
              tone="warning"
              variant="secondary"
              shape="rounded"
              role="status"
              aria-label={t('features.amendments.streetscape.status.unsavedChanges')}
              className="h-9 gap-1.5 px-3 py-2 font-medium whitespace-nowrap"
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t('features.amendments.streetscape.status.unsavedChanges')}
            </BadgeControl>
          ) : null}
          {headerActions}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );

  if (contentOnly) return workspaceCard;

  return (
    <div
      className={cn(embedded ? 'bg-background min-h-full' : 'space-y-2 pt-5', className)}
      data-testid="street-design-workspace"
      data-embedded={embedded || undefined}
    >
      {topBar}
      <div className={cn(embedded ? 'p-3 sm:p-4' : 'w-full pt-8 pb-8')}>
        {beforeCard}
        {workspaceCard}
      </div>
    </div>
  );
}
