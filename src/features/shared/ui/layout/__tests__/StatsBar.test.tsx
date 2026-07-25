/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatsBar } from '../StatsBar';

afterEach(cleanup);

function renderStats(count: number) {
  const { container } = render(
    <StatsBar
      items={Array.from({ length: count }, (_, index) => ({
        value: index + 1,
        label: `Label ${index + 1}`,
      }))}
    />
  );

  return container.querySelector('[data-mobile-columns]');
}

describe('StatsBar mobile grid', () => {
  it.each([
    [1, '1'],
    [2, '2'],
    [3, '3'],
    [4, '2'],
    [5, '3'],
    [6, '2'],
  ])('uses the expected mobile column count for %i visible items', (count, columns) => {
    expect(renderStats(count)?.getAttribute('data-mobile-columns')).toBe(columns);
  });

  it('centers the incomplete final row when five items are visible', () => {
    renderStats(5);

    expect(screen.getByText('Label 4').parentElement?.className).toContain('col-start-2');
  });

  it('ignores hidden items when resolving the mobile grid', () => {
    const { container } = render(
      <StatsBar
        items={[
          { value: 1, label: 'Visible 1' },
          { value: 2, label: 'Hidden', show: false },
          { value: 3, label: 'Visible 2' },
        ]}
      />
    );

    expect(
      container.querySelector('[data-mobile-columns]')?.getAttribute('data-mobile-columns')
    ).toBe('2');
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});
