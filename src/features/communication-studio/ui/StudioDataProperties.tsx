import { useState } from 'react';
import { InlineCheckbox } from '@/features/shared/ui/form/InlineCheckbox';
import type { StudioElement } from '../logic/document';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  deleteTableColumns,
  deleteTableRows,
  insertTableColumn,
  insertTableRow,
} from '../logic/table-operations';
export function StudioDataProperties({
  element: e,
  patch,
}: {
  element: StudioElement;
  patch: (patch: Partial<StudioElement>) => void;
}) {
  const { t } = useTranslation();
  const [activeCell, setActiveCell] = useState({ row: 0, column: 0 });
  const tr = (k: string) => t('features.studio.' + k);
  const table = e.table,
    chart = e.chart;
  const editTable = (
    table: NonNullable<StudioElement['table']>,
    fn: (v: NonNullable<StudioElement['table']>) => void
  ) => {
    const next = structuredClone(table);
    fn(next);
    patch({ table: next });
  };
  const editChart = (
    chart: NonNullable<StudioElement['chart']>,
    fn: (v: NonNullable<StudioElement['chart']>) => void
  ) => {
    const next = structuredClone(chart);
    fn(next);
    patch({ chart: next });
  };
  return (
    <div className="space-y-3">
      {table && (
        <>
          <div className="overflow-auto">
            <table>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, c) => (
                      <td key={cell.id} className="min-w-24 border p-1">
                        <input
                          aria-label={`${tr('cell')} ${r + 1}, ${c + 1}`}
                          className="w-full"
                          value={cell.text}
                          onFocus={() => setActiveCell({ row: r, column: c })}
                          onChange={ev =>
                            editTable(table, t => (t.rows[r].cells[c].text = ev.target.value))
                          }
                        />
                        <input
                          aria-label={tr('background')}
                          type="color"
                          value={cell.fill}
                          onChange={ev =>
                            editTable(table, t => (t.rows[r].cells[c].fill = ev.target.value))
                          }
                        />
                        <input
                          aria-label={tr('color')}
                          type="color"
                          value={cell.color}
                          onChange={ev =>
                            editTable(table, t => (t.rows[r].cells[c].color = ev.target.value))
                          }
                        />
                        <select
                          aria-label={tr('alignment')}
                          value={cell.align}
                          onChange={ev =>
                            editTable(
                              table,
                              t => (t.rows[r].cells[c].align = ev.target.value as typeof cell.align)
                            )
                          }
                        >
                          {['left', 'center', 'right'].map(v => (
                            <option key={v} value={v}>
                              {tr(v)}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2">
                          <InlineCheckbox
                            data-action-id="studio.data.table.bold.toggle"
                            checked={cell.bold}
                            onCheckedChange={value =>
                              editTable(table, t => (t.rows[r].cells[c].bold = value === true))
                            }
                          />
                          {tr('bold')}
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              data-action-id="studio.data.table.row.add"
              data-action-kind="interaction"
              disabled={table.rows.length >= 50}
              onClick={() => patch({ table: insertTableRow(table, table.rows.length) })}
            >
              {tr('addRow')}
            </button>
            <button
              data-action-id="studio.data.table.row.remove"
              data-action-kind="interaction"
              disabled={table.rows.length <= 1}
              onClick={() =>
                patch({
                  table: deleteTableRows(table, {
                    anchorRow: activeCell.row,
                    focusRow: activeCell.row,
                    anchorColumn: activeCell.column,
                    focusColumn: activeCell.column,
                  }),
                })
              }
            >
              {tr('removeRow')}
            </button>
            <button
              data-action-id="studio.data.table.column.add"
              data-action-kind="interaction"
              disabled={table.widths.length >= 20}
              onClick={() => patch({ table: insertTableColumn(table, table.widths.length) })}
            >
              {tr('addColumn')}
            </button>
            <button
              data-action-id="studio.data.table.column.remove"
              data-action-kind="interaction"
              disabled={table.widths.length <= 1}
              onClick={() =>
                patch({
                  table: deleteTableColumns(table, {
                    anchorRow: activeCell.row,
                    focusRow: activeCell.row,
                    anchorColumn: activeCell.column,
                    focusColumn: activeCell.column,
                  }),
                })
              }
            >
              {tr('removeColumn')}
            </button>
          </div>
          {table.widths.map((w, c) => (
            <label key={c}>
              {tr('columnWidth')} {c + 1}
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={w}
                onChange={ev => {
                  const n = ev.target.valueAsNumber;
                  if (n >= 0.01 && n <= 1) editTable(table, t => (t.widths[c] = n));
                }}
              />
            </label>
          ))}
          <label>
            {tr('border')}
            <input
              type="color"
              value={table.border}
              onChange={ev => editTable(table, t => (t.border = ev.target.value))}
            />
          </label>
        </>
      )}
      {chart && (
        <>
          <select
            aria-label={tr('chartType')}
            value={chart.kind}
            onChange={ev => {
              const kind = ev.target.value as typeof chart.kind;
              editChart(chart, c => {
                c.kind = kind;
                if (kind === 'pie') {
                  c.series = c.series.slice(0, 1);
                  c.series[0].values = c.series[0].values.map(v => Math.max(1, v));
                }
              });
            }}
          >
            {['bar', 'line', 'pie'].map(v => (
              <option key={v} value={v}>
                {tr(v)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <InlineCheckbox
              data-action-id="studio.data.chart.legend.toggle"
              checked={chart.legend}
              onCheckedChange={value => editChart(chart, c => (c.legend = value === true))}
            />
            {tr('legend')}
          </label>
          {chart.series.map((s, j) => (
            <div key={s.id}>
              <input
                aria-label={tr('series')}
                value={s.name}
                onChange={ev => editChart(chart, c => (c.series[j].name = ev.target.value))}
              />
              <input
                aria-label={tr('color')}
                type="color"
                value={s.color}
                onChange={ev => editChart(chart, c => (c.series[j].color = ev.target.value))}
              />
            </div>
          ))}
          {chart.labels.map((label, i) => (
            <div key={i} className="flex gap-1">
              <input
                aria-label={tr('label')}
                className="w-24 min-w-0"
                value={label}
                onChange={ev => editChart(chart, c => (c.labels[i] = ev.target.value))}
              />
              {chart.kind === 'pie' && (
                <input
                  type="color"
                  aria-label={`${tr('color')} ${label}`}
                  value={
                    (chart.colors ?? [
                      '#B88A3B',
                      '#12362D',
                      '#588DB2',
                      '#9A597F',
                      '#75965D',
                      '#D46E48',
                    ])[i % (chart.colors?.length ?? 6)]
                  }
                  onChange={ev =>
                    editChart(chart, c => {
                      c.colors = c.labels.map(
                        (_, index) =>
                          (c.colors ?? [
                            '#B88A3B',
                            '#12362D',
                            '#588DB2',
                            '#9A597F',
                            '#75965D',
                            '#D46E48',
                          ])[index % (c.colors?.length ?? 6)]
                      );
                      c.colors[i] = ev.target.value;
                    })
                  }
                />
              )}
              {chart.series.map((s, j) => (
                <input
                  key={s.id}
                  aria-label={`${s.name} ${label}`}
                  className="w-20 min-w-0"
                  type="number"
                  value={s.values[i]}
                  onChange={ev => {
                    const n = ev.target.valueAsNumber;
                    if (Number.isFinite(n))
                      editChart(
                        chart,
                        c => (c.series[j].values[i] = c.kind === 'pie' ? Math.max(0.01, n) : n)
                      );
                  }}
                />
              ))}
            </div>
          ))}
          <button
            disabled={chart.labels.length >= 100}
            onClick={() =>
              editChart(chart, c => {
                c.labels.push(String(c.labels.length + 1));
                c.series.forEach(s => s.values.push(1));
              })
            }
          >
            {tr('addData')}
          </button>
          <button
            disabled={chart.labels.length <= 1}
            onClick={() =>
              editChart(chart, c => {
                c.labels.pop();
                c.series.forEach(s => s.values.pop());
              })
            }
          >
            {tr('removeData')}
          </button>
          <button
            disabled={chart.kind === 'pie' || chart.series.length >= 10}
            onClick={() =>
              editChart(chart, c =>
                c.series.push({
                  id: crypto.randomUUID(),
                  name: tr('series'),
                  color: '#588DB2',
                  values: c.labels.map(() => 1),
                })
              )
            }
          >
            {tr('addSeries')}
          </button>
          <button
            disabled={chart.series.length <= 1}
            onClick={() =>
              editChart(chart, c => {
                c.series.pop();
              })
            }
          >
            {tr('removeSeries')}
          </button>
        </>
      )}
    </div>
  );
}
