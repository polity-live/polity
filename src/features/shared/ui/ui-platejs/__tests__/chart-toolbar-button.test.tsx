/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDataViewDialog } from '@/features/charts/ui/ChartDialog';
import { Toolbar } from '@/features/shared/ui/layout';
import { ChartToolbarButton } from '../chart-toolbar-button';

vi.mock('@/features/charts/ui/ChartDialog', () => ({
  openDataViewDialog: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('ChartToolbarButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderButton = (button?: ReactNode) =>
    render(<Toolbar>{button ?? <ChartToolbarButton />}</Toolbar>);

  it('opens the shared data dialog', () => {
    const { getByRole } = renderButton();
    const button = getByRole('button');

    expect(button.getAttribute('data-plate-focus')).toBe('true');

    fireEvent.click(button);

    expect(openDataViewDialog).toHaveBeenCalledTimes(1);
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

    expect(openDataViewDialog).not.toHaveBeenCalled();
  });
});
