import * as React from 'react';
import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createDataViewProjection } from '../api/datasetClient';
import type { DataViewProjection, TDataViewElement } from '../types';
import { ChartRenderer } from './ChartRenderer';
import { DataViewAttribution } from './DataViewAttribution';

export function DataViewRenderer({
  element,
  accessToken,
  staticMode = false,
}: {
  element: TDataViewElement;
  accessToken?: string | null;
  staticMode?: boolean;
}) {
  const { t } = useTranslation();
  const [projection, setProjection] = React.useState<DataViewProjection | null>(null);
  const [loading, setLoading] = React.useState(!staticMode);
  const [error, setError] = React.useState<string | null>(null);
  const requestKey = React.useMemo(
    () =>
      JSON.stringify({
        snapshotId: element.source.snapshotId,
        view: element.view,
        ...element.query,
      }),
    [element.query, element.source.snapshotId, element.view]
  );

  React.useEffect(() => {
    if (staticMode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void createDataViewProjection(
      { snapshotId: element.source.snapshotId, view: element.view, ...element.query },
      accessToken
    )
      .then(result => {
        if (!cancelled) setProjection(result);
      })
      .catch(loadError => {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, requestKey, staticMode]);

  if (staticMode) {
    return (
      <div className="border-y py-5">
        <p className="text-sm font-semibold">
          {element.presentation.title || element.source.title}
        </p>
        <DataViewAttribution source={element.source} className="mt-1" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        {t('plateJs.dataView.loading')}
      </div>
    );
  }
  if (error || !projection) {
    return (
      <div className="text-destructive flex min-h-32 items-center justify-center px-6 text-center text-sm">
        {error || t('plateJs.dataView.previewUnavailable')}
      </div>
    );
  }
  if (projection.view === 'chart') {
    return (
      <div>
        <ChartRenderer
          chartType={element.chartType ?? 'bar'}
          points={projection.points}
          presentation={element.presentation}
        />
        <DataViewAttribution source={element.source} className="mt-3" />
      </div>
    );
  }
  if (projection.view === 'stat') {
    return (
      <div>
        <div className="border-y py-7 text-center">
          <p className="text-muted-foreground text-sm">
            {element.presentation.title || projection.label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {projection.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          {element.presentation.description ? (
            <p className="text-muted-foreground mt-2 text-xs">{element.presentation.description}</p>
          ) : null}
        </div>
        <DataViewAttribution source={element.source} className="mt-3" />
      </div>
    );
  }

  return (
    <figure className="m-0">
      {element.presentation.title ? (
        <figcaption className="mb-3">
          <p className="text-sm font-semibold">{element.presentation.title}</p>
          {element.presentation.description ? (
            <p className="text-muted-foreground mt-1 text-xs">{element.presentation.description}</p>
          ) : null}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              {projection.columns.map(column => (
                <th key={column} className="bg-muted/40 px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                {projection.columns.map(column => (
                  <td key={column} className="px-3 py-2 align-top">
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataViewAttribution source={element.source} className="mt-3" />
    </figure>
  );
}
