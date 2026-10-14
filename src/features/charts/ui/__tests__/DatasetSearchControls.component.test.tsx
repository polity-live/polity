// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { DatasetSearchControls } from '../DatasetSearchControls';
import { interpretDatasetSearch } from '../../logic/datasetSearch';
import type { DatasetSearchFilters } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
it('opens empty filter drafts, cancels by Escape and ignores invalid form submissions', async () => {
  const setFilters = vi.fn();
  const user = userEvent.setup();
  render(
    <DatasetSearchControls intent={interpretDatasetSearch('population')} setFilters={setFilters} />
  );
  await user.click(screen.getByRole('button', { name: 'plateJs.dataView.addSearchArea' }));
  const area = screen.getByRole('textbox', { name: 'plateJs.dataView.searchArea' });
  expect((area as HTMLInputElement).value).toBe('');
  fireEvent.submit(area.closest('form')!);
  expect(setFilters).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'plateJs.dataView.addSearchPeriod' }));
  const start = screen.getByRole('spinbutton', { name: 'plateJs.dataView.searchYearFrom' });
  expect((start as HTMLInputElement).value).toBe('');
  fireEvent.submit(start.closest('form')!);
  expect(setFilters).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
});

it('edits and removes area and period with keyboard focus and rejects invalid local filter drafts', async () => {
  function Harness() {
    const [filters, setFilters] = useState<DatasetSearchFilters>({
      area: 'Berlin',
      period: { start: 2024, end: 2025 },
    });
    return (
      <>
        <DatasetSearchControls
          intent={interpretDatasetSearch('population', filters)}
          setFilters={setFilters}
        />
        <output data-testid="filters">{JSON.stringify(filters)}</output>
      </>
    );
  }
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  const user = userEvent.setup();
  render(<Harness />);
  const area = screen.getByRole('button', { name: 'plateJs.dataView.searchArea: Berlin' });
  area.focus();
  expect(document.activeElement).toBe(area);
  await user.keyboard('{Enter}');
  const input = await screen.findByRole('textbox', { name: 'plateJs.dataView.searchArea' });
  expect(document.activeElement).toBe(input);
  await user.clear(input);
  expect(
    (
      screen.getByRole('button', {
        name: 'plateJs.dataView.applySearchFilter',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  await user.type(input, ' Hamburg ');
  await user.keyboard('{Enter}');
  expect(screen.getByTestId('filters').textContent).toContain('Hamburg');
  expect(document.activeElement).toBe(area);
  const period = screen.getByRole('button', { name: 'plateJs.dataView.searchPeriod: 2024–2025' });
  period.focus();
  await user.keyboard('{Enter}');
  const start = screen.getByRole('spinbutton', { name: 'plateJs.dataView.searchYearFrom' });
  await user.clear(start);
  await user.type(start, '2026');
  expect(
    (
      screen.getByRole('button', {
        name: 'plateJs.dataView.applySearchFilter',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  const end = screen.getByRole('spinbutton', { name: 'plateJs.dataView.searchYearTo' });
  await user.clear(end);
  await user.type(end, '2027');
  const apply = screen.getByRole('button', { name: 'plateJs.dataView.applySearchFilter' });
  apply.focus();
  expect(document.activeElement).toBe(apply);
  await user.keyboard('{Enter}');
  expect(screen.getByTestId('filters').textContent).toContain('"start":2026,"end":2027');
  for (const kind of ['Area', 'Period']) {
    const remove = screen.getByRole('button', { name: `plateJs.dataView.removeSearch${kind}` });
    remove.focus();
    expect(document.activeElement).toBe(remove);
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('filters').textContent).toContain(`"${kind.toLowerCase()}":null`);
  }
});
