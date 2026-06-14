/* @vitest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openChartDialog } from '@/features/charts/ui/ChartDialog';
import { Toolbar } from '@/features/shared/ui/ui/toolbar.tsx';
import { ChartToolbarButton } from '../chart-toolbar-button';

vi.mock('@/features/charts/ui/ChartDialog', () => ({
  openChartDialog: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('ChartToolbarButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderButton = (button?: ReactNode) =>
    render(<Toolbar>{button ?? <ChartToolbarButton />}</Toolbar>);

  it('opens the chart dialog through the shared chart entrypoint', () => {
    const { getByRole } = renderButton();
    const button = getByRole('button');

    expect(button.getAttribute('data-plate-focus')).toBe('true');

    fireEvent.click(button);

    expect(openChartDialog).toHaveBeenCalledTimes(1);
  });

  it('respects a prevented click from caller props', () => {
    const { getByRole } = renderButton(
      <ChartToolbarButton
        onClick={event => {
          event.preventDefault();
        }}
      />
    );
    const button = getByRole('button');

    fireEvent.click(button);

    expect(openChartDialog).not.toHaveBeenCalled();
  });
});
