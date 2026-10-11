// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { ChartTypeSelector } from '../ChartTypeSelector';
import type { ChartType } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('selects every enabled chart type by keyboard and blocks a disabled pie choice', async () => {
  const change = vi.fn();
  function Harness({ pieDisabled = false }: { pieDisabled?: boolean }) {
    const [value, setValue] = useState<ChartType>('bar');
    return (
      <ChartTypeSelector
        value={value}
        pieDisabled={pieDisabled}
        onValueChange={next => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  const user = userEvent.setup();
  const view = render(<Harness />);
  for (const kind of ['line', 'area', 'pie', 'bar']) {
    const button = screen.getByRole('radio', { name: `plateJs.chart.${kind}` });
    expect(button.getAttribute('aria-checked')).toBe('false');
    button.focus();
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(change).toHaveBeenLastCalledWith(kind);
    expect(document.activeElement).toBe(button);
  }
  view.rerender(<Harness pieDisabled />);
  const pie = screen.getByRole('radio', { name: 'plateJs.chart.pie' });
  expect((pie as HTMLButtonElement).disabled).toBe(true);
  change.mockClear();
  await user.click(pie);
  expect(change).not.toHaveBeenCalled();
});
