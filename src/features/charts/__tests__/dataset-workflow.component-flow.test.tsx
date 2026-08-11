/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import {
  buildDatasetProjectionPoints,
  parseDatasetCsv,
  profileDatasetColumns,
  type DatasetTable,
} from '@/server/datasets/csv';

function DatasetFlow() {
  const [table, setTable] = useState<DatasetTable | null>(null);
  const [points, setPoints] = useState<{ x: string; value: number }[]>([]);
  return (
    <section>
      <button
        type="button"
        onClick={() => setTable(parseDatasetCsv('Year,Value\n2025,10\n2026,14'))}
      >
        Upload CSV
      </button>
      <button
        type="button"
        disabled={!table}
        onClick={() =>
          setPoints(
            buildDatasetProjectionPoints(table!, {
              xColumn: 'Year',
              valueColumn: 'Value',
              seriesColumn: null,
              tableMode: 'columnMapping',
            })
          )
        }
      >
        Build projection
      </button>
      {table ? (
        <output aria-label="dataset columns">
          {profileDatasetColumns(table)
            .map(profile => `${profile.name}:${profile.type}`)
            .join(',')}
        </output>
      ) : null}
      <ul>
        {points.map(point => (
          <li key={point.x}>
            {point.x}: {point.value}
          </li>
        ))}
      </ul>
    </section>
  );
}

afterEach(cleanup);

describe('dataset workflow component flow', () => {
  it('uploads and parses CSV into profiled application columns', () => {
    renderComponentFlow(<DatasetFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }));
    expect(screen.getByLabelText('dataset columns').textContent).toContain('Year:date');
    expect(screen.getByLabelText('dataset columns').textContent).toContain('Value:number');
  });

  it('configures a projection from the uploaded dataset', () => {
    renderComponentFlow(<DatasetFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build projection' }));
    expect(screen.getByText('2025: 10')).toBeTruthy();
    expect(screen.getByText('2026: 14')).toBeTruthy();
  });

  it('keeps projection unavailable until a valid upload exists', () => {
    renderComponentFlow(<DatasetFlow />);
    expect(
      (screen.getByRole('button', { name: 'Build projection' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.queryByLabelText('dataset columns')).toBeNull();
  });
});
