'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/features/shared/utils/utils';
import {
  sourceLabel,
  localizedDate,
  type DataViewAttributionSource,
} from '../logic/dataViewAttribution';
export type { DataViewAttributionSource } from '../logic/dataViewAttribution';

export function DataViewAttribution({
  source,
  className,
}: {
  source: DataViewAttributionSource;
  className?: string;
}) {
  const { i18n, t } = useTranslation();
  const label = sourceLabel(source);
  const date = localizedDate(source.snapshotTakenAt, i18n.resolvedLanguage);
  const linkedSource = source.sourceUrl && source.provider !== 'UPLOAD';

  return (
    <p
      className={cn('text-muted-foreground text-xs', className)}
      data-testid="data-view-attribution"
    >
      {t('plateJs.dataView.source')}:{' '}
      {linkedSource ? (
        <a
          data-action-id="charts.attribution.open-source"
          href={source.sourceUrl as string}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
      {date ? ` · ${t('plateJs.dataView.dataAsOf', { date })}` : null}
    </p>
  );
}
