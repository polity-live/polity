import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createEurostatPreviewRows,
  type EurostatObservationLike,
} from '../logic/eurostatChartPreview';
import type { EurostatDimension } from '../types';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';

interface EurostatObservationPreviewTableProps {
  dimensions: readonly EurostatDimension[];
  loading?: boolean;
  rows: readonly EurostatObservationLike[];
}

export function EurostatObservationPreviewTable({
  dimensions,
  loading = false,
  rows,
}: EurostatObservationPreviewTableProps) {
  const { t } = useTranslation();
  const previewRows = createEurostatPreviewRows(rows, dimensions);
  type PreviewRow = (typeof previewRows)[number];

  const hasAttributes = previewRows.some(row => row.attributesText);
  const columns = useMemo<ColumnDef<PreviewRow>[]>(
    () => [
      ...dimensions.map<ColumnDef<PreviewRow>>(dimension => ({
        id: dimension.id,
        header: dimension.label ? `${dimension.id} · ${dimension.label}` : dimension.id,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.dimensionValues[dimension.id] || '-'}</span>
        ),
      })),
      {
        id: 'value',
        header: 'OBS_VALUE',
        cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.value}</span>,
      },
      ...(hasAttributes
        ? [
            {
              id: 'attributes',
              header: t('plateJs.chart.attributes'),
              cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                  {row.original.attributesText || '-'}
                </span>
              ),
            } satisfies ColumnDef<PreviewRow>,
          ]
        : []),
    ],
    [dimensions, hasAttributes, t]
  );

  return (
    <DataTable
      columns={columns}
      data={previewRows}
      getRowId={row => row.id}
      isLoading={loading}
      loadingRowCount={5}
      emptyTitle={
        loading ? t('plateJs.chart.loadingPreviewRows') : t('plateJs.chart.noPreviewRows')
      }
      rowTestId="eurostat-observation-preview-row"
      enablePagination={false}
      tableClassName="[&_th]:min-w-40 [&_th]:whitespace-nowrap [&_td]:align-top"
    />
  );
}
