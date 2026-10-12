import { DatasetProcessingError } from './DatasetProcessingError';
import type { DatasetRawDownloadTarget } from '../logic/datasetRawDownload';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { DatasetPreview, EurostatDimension } from '../types';
import { PolityLoadingScreen } from '@/features/shared/ui/feedback/PolityLoadingScreen';
import { orderDatasetPreviewColumns } from '../logic/datasetPreviewColumns';

export function DatasetSamplePreview({
  preview,
  loading,
  error,
  onRetry,
  downloadTarget,
  downloadAccessToken,
  sourceUrl,
}: {
  preview?: DatasetPreview | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  downloadTarget?: DatasetRawDownloadTarget;
  downloadAccessToken?: string | null;
  sourceUrl?: string | null;
}) {
  const { t } = useTranslation();
  const [technical, setTechnical] = React.useState(false);
  const dimensions = preview?.metadata?.providerDimensions as EurostatDimension[] | undefined;
  const columns = orderDatasetPreviewColumns(preview?.columns ?? []).filter(
    column => technical || !column.technical
  );
  return (
    <section
      aria-label={t('plateJs.dataView.dataSample')}
      className="mt-5 min-w-0 space-y-3 border-t pt-4"
      aria-busy={loading || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{t('plateJs.dataView.dataSample')}</h4>
        {preview?.columns.some(column => column.technical) && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-action-id="charts.dataset-sample.columns.toggle-technical"
              checked={technical}
              onChange={event => setTechnical(event.target.checked)}
            />
            {t('plateJs.dataView.technicalColumns')}
          </label>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-5">
          <PolityLoadingScreen label={t('plateJs.dataView.loadingDataSample')} />
        </div>
      ) : error ? (
        <DatasetProcessingError
          message={error}
          target={downloadTarget}
          sourceUrl={sourceUrl}
          accessToken={downloadAccessToken}
          onRetry={onRetry}
          hint={t('plateJs.dataView.sampleNarrowHint')}
        />
      ) : preview ? (
        <>
          <p className="text-muted-foreground text-xs">
            {t('plateJs.dataView.sampleDescription', { count: preview.rows.length })}
          </p>
          {(preview.appliedFilters.area ||
            preview.appliedFilters.period ||
            Object.keys(preview.appliedFilters.dimensions ?? {}).length > 0 ||
            Object.keys(preview.rowFilters).length > 0 ||
            preview.timeRange) && (
            <p className="text-muted-foreground text-xs">
              {t('plateJs.dataView.sampleScope')}:{' '}
              {[
                preview.appliedFilters.area,
                preview.appliedFilters.period
                  ? `${preview.appliedFilters.period.start === 1800 ? '…' : preview.appliedFilters.period.start}–${preview.appliedFilters.period.end === 2199 ? '…' : preview.appliedFilters.period.end}`
                  : null,
                preview.timeRange
                  ? `${preview.timeRange.startYear === 1800 ? '…' : preview.timeRange.startYear}–${preview.timeRange.endYear === 2199 ? '…' : preview.timeRange.endYear}`
                  : null,
                ...Object.entries({
                  ...preview.appliedFilters.dimensions,
                  ...preview.rowFilters,
                }).map(
                  ([id, value]) =>
                    `${dimensions?.find(item => item.id === id)?.label ?? id}: ${dimensions?.find(item => item.id === id)?.values.find(item => item.id === value)?.label ?? value}`
                ),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {preview.rows.length === 0 ? (
            <p role="status" className="text-sm">
              {t('plateJs.dataView.sampleEmpty')}
            </p>
          ) : (
            <div
              className="max-w-full overflow-x-auto rounded-sm border"
              tabIndex={0}
              role="region"
              aria-label={t('plateJs.dataView.dataSample')}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    {columns.map(column => (
                      <th
                        key={column.name}
                        scope="col"
                        className="bg-muted/40 border-b px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {columns.map(column => (
                      <td
                        key={column.name}
                        className="text-muted-foreground border-b px-3 py-1 whitespace-nowrap"
                      >
                        {t(`plateJs.dataView.dataTypes.${column.type}`)}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {columns.map(column => {
                        const raw = row[column.name];
                        const value = !column.technical
                          ? (dimensions
                              ?.find(item => item.id === column.name)
                              ?.values.find(item => item.id === raw)?.label ?? raw)
                          : raw;
                        return (
                          <td key={column.name} className="border-b px-3 py-2 whitespace-nowrap">
                            {value === '' || value == null ? (
                              <span className="text-muted-foreground">
                                {t('plateJs.dataView.missingValue')}
                              </span>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
