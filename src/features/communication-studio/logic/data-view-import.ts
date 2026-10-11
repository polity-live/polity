import { CHART_PALETTE } from '@/features/charts/logic/chartPalette';
import { DataViewInsertionError } from '@/features/charts/logic/dataViewInsertion';
import type { ChartType, DataViewProjection, TDataViewElement } from '@/features/charts/types';
import { localizedDate, sourceLabel } from '@/features/charts/logic/dataViewAttribution';
import { translate as tr } from '@/features/shared/hooks/use-translation';
import { element, chartDataSchema, tableDataSchema, type StudioElement } from './document';
import { activePalette, paletteColor, themeToLegacyBrand } from './theme';
import { createStudioNodeFromElement } from './create-studio-node';
import type { FrameNode, StudioDocumentV3, StudioNode } from './document-v3';

const palette = [...CHART_PALETTE];

/** Validates the displayed result, never truncating rows, categories, or series. */
export function validateStudioDataProjection(
  projection: DataViewProjection,
  kind: ChartType
): string | null {
  if (projection.view === 'stat')
    return Number.isFinite(projection.value) && projection.rowCount > 0
      ? null
      : tr('features.studio.dataImport.empty');
  if (projection.view === 'table') {
    if (projection.rows.length + 1 > 50 || projection.columns.length > 20)
      return tr('features.studio.dataImport.tableLimit');
    if (
      !projection.rows.length ||
      !projection.columns.length ||
      new Set(projection.columns).size !== projection.columns.length
    )
      return tr('features.studio.dataImport.empty');
    if (
      projection.columns.some(c => c.length > 10000) ||
      projection.rows.some(r => projection.columns.some(c => String(r[c] ?? '').length > 10000))
    )
      return tr('features.studio.dataImport.invalid');
    return null;
  }
  const categories = new Set(projection.points.map(p => p.x));
  const series = new Set(projection.points.map(p => p.series || 'value'));
  if (
    categories.size > 100 ||
    series.size > 10 ||
    (kind === 'pie' && projection.points.length > 100)
  )
    return tr('features.studio.dataImport.chartLimit');
  if (
    !projection.points.length ||
    projection.points.some(
      p =>
        !Number.isFinite(p.value) ||
        typeof p.x !== 'string' ||
        p.x.length > 10000 ||
        (p.series?.length ?? 0) > 10000
    )
  )
    return tr('features.studio.dataImport.empty');
  if (
    kind === 'pie' &&
    (projection.points.some(p => p.value < 0) || !projection.points.some(p => p.value > 0))
  )
    return tr('features.studio.dataImport.pieValues');
  return null;
}

export function studioChartFromProjection(
  configuration: TDataViewElement,
  projection: Extract<DataViewProjection, { view: 'chart' }>
) {
  const kind = configuration.chartType ?? 'bar';
  const names = [...new Set(projection.points.map(p => p.series || 'value'))];
  const labels = [...new Set(projection.points.map(p => p.x))];
  return chartDataSchema.parse({
    kind,
    // Pie previews show one slice per point, including when points have series labels.
    labels:
      kind === 'pie'
        ? projection.points.map(p => (names.length > 1 ? `${p.x} · ${p.series || 'value'}` : p.x))
        : labels,
    series:
      kind === 'pie'
        ? [
            {
              id: crypto.randomUUID(),
              name: configuration.source.title,
              color: palette[0],
              values: projection.points.map(p => p.value),
            },
          ]
        : names.map((name, i) => ({
            id: crypto.randomUUID(),
            name,
            color: palette[i % palette.length],
            values: labels.map(label => {
              // Matches the preview: the last point for each category/series wins.
              const points = projection.points.filter(
                p => p.x === label && (p.series || 'value') === name
              );
              return points.at(-1)?.value ?? null;
            }),
          })),
    legend: configuration.presentation.showLegend !== false && (kind === 'pie' || names.length > 1),
    grid: configuration.presentation.showGrid !== false,
    donut: configuration.presentation.donut === true,
    xAxisLabel: configuration.presentation.xAxisLabel,
    yAxisLabel: configuration.presentation.yAxisLabel,
    colors: palette,
  });
}

/** Resolved values only: these nodes never retain dataset queries or live bindings. */
export function createStudioDataViewNodes(
  configuration: TDataViewElement,
  projection: DataViewProjection,
  frame: FrameNode,
  zIndex = 0,
  language = 'de',
  appearance?: { foreground: string; font: StudioElement['font'] }
): StudioNode[] {
  const issue = validateStudioDataProjection(projection, configuration.chartType ?? 'bar');
  if (issue || projection.view !== configuration.view)
    throw new DataViewInsertionError(issue ?? tr('features.studio.dataImport.invalid'));
  const groupId = crypto.randomUUID();
  const foreground = appearance?.foreground ?? '#12362D';
  const width = Math.min(frame.transform.width * 0.88, 4400);
  const height = Math.min(frame.transform.height * 0.88, 4400);
  const x = (frame.transform.width - width) / 2;
  const top = (frame.transform.height - height) / 2;
  const nodes: StudioNode[] = [];
  const add = (
    type: 'text' | 'chart' | 'table',
    y: number,
    h: number,
    values: Parameters<typeof element>[1]
  ) => {
    const node = createStudioNodeFromElement(
      element(type, {
        x: 0,
        y: 0,
        width,
        height: h,
        fill: foreground,
        font: appearance?.font ?? 'Manrope',
        ...values,
      }),
      frame.id,
      zIndex + nodes.length
    );
    node.transform.x = x;
    node.transform.y = top + y;
    node.groupIds = [groupId];
    if (node.type === 'richText' && values?.bold)
      node.content.forEach(p =>
        p.children.forEach(child => {
          if ('text' in child) child.bold = true;
        })
      );
    nodes.push(node);
  };
  const title = configuration.presentation.title || configuration.source.title;
  const description = configuration.presentation.description?.trim();
  const titleHeight = title ? height * 0.1 : 0;
  const descriptionHeight = description ? height * 0.09 : 0;
  const textScale = Math.min(width / 700, height / 500);
  if (title)
    add('text', 0, titleHeight, {
      text: title,
      fontSize: Math.max(8, 14 * textScale),
      bold: true,
    });
  if (description)
    add('text', titleHeight, descriptionHeight, {
      text: description,
      fontSize: Math.max(8, 12 * textScale),
    });
  const contentTop = titleHeight + descriptionHeight + height * 0.02;
  const contentHeight = height * 0.83 - contentTop;
  if (projection.view === 'chart')
    add('chart', contentTop, contentHeight, {
      chart: {
        ...studioChartFromProjection(configuration, projection),
        fontFamily: appearance?.font ?? 'Manrope',
      },
    });
  else if (projection.view === 'table') {
    const rows = [Object.fromEntries(projection.columns.map(c => [c, c])), ...projection.rows];
    const table = tableDataSchema.parse({
      widths: projection.columns.map(() => 1 / projection.columns.length),
      rows: rows.map((row, i) => ({
        id: crypto.randomUUID(),
        cells: projection.columns.map(column => ({
          id: crypto.randomUUID(),
          text: String(row[column] ?? ''),
          bold: i === 0,
          fill: i === 0 ? '#E8EDE5' : '#FFFFFF',
        })),
      })),
    });
    add('table', contentTop, contentHeight, {
      table,
      fontSize: Math.max(
        8,
        Math.min(24, (contentHeight / rows.length) * 0.5, width / projection.columns.length / 10)
      ),
    });
  } else {
    add('text', contentTop + contentHeight * 0.2, contentHeight * 0.4, {
      text: new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(projection.value),
      fontSize: Math.max(8, Math.min(140, contentHeight * 0.4)),
      align: 'center',
      verticalAlign: 'middle',
    });
    add('text', contentTop + contentHeight * 0.62, contentHeight * 0.2, {
      text: projection.label,
      fontSize: Math.max(8, Math.min(36, contentHeight * 0.12)),
      align: 'center',
    });
  }
  const date = localizedDate(configuration.source.snapshotTakenAt, language);
  const attribution = `${tr('plateJs.dataView.source')}: ${sourceLabel(configuration.source)}${date ? ` · ${tr('plateJs.dataView.dataAsOf', { date })}` : ''}${configuration.source.sourceUrl ? `\n${configuration.source.sourceUrl}` : ''}`;
  add('text', height * 0.86, height * 0.14, {
    text: attribution,
    fontSize: Math.max(8, 12 * textScale),
  });
  return nodes;
}

export function insertStudioDataView(
  document: StudioDocumentV3,
  frameId: string,
  configuration: TDataViewElement,
  projection: DataViewProjection,
  language?: string
) {
  const frame = document.nodes.find((n): n is FrameNode => n.id === frameId && n.type === 'frame');
  if (!frame) throw new DataViewInsertionError(tr('features.studio.dataImport.invalid'));
  const zIndex =
    Math.max(0, ...document.nodes.filter(n => n.parentFrameId === frameId).map(n => n.zIndex)) + 1;
  const brand = themeToLegacyBrand(document.theme);
  const palette = activePalette(document.theme);
  const background = frame.style.fillBinding
    ? paletteColor(palette, frame.style.fillBinding)
    : (frame.style.fill ?? document.frameDefaults.background ?? palette.background);
  const [red, green, blue] = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  const foreground =
    red * 0.299 + green * 0.587 + blue * 0.114 < 128 ? '#FFFFFF' : brand.foreground;
  const nodes = createStudioDataViewNodes(configuration, projection, frame, zIndex, language, {
    foreground,
    font: brand.bodyFont,
  });
  document.nodes.push(...nodes);
  return nodes.map(n => n.id);
}
