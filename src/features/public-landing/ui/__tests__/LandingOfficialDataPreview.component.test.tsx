/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingOfficialDataPreview } from '../LandingOfficialDataPreview';

const arrays: Record<string, string[]> = {
  'pages.home.publicLanding.officialDataPreview.resultTitles': [
    'Modal split in European cities',
    'Commuter flows by municipality',
    'Municipal traffic counts 2025',
    'Project team mobility count',
  ],
  'pages.home.publicLanding.officialDataPreview.resultPublishers': [
    'Eurostat',
    'Federal Statistical Office',
    'Mobility Department',
    'Project team',
  ],
  'pages.home.publicLanding.officialDataPreview.resultCoverage': [
    'EU',
    'Germany',
    'Berlin',
    'City centre',
  ],
  'pages.home.publicLanding.officialDataPreview.resultStructure': [
    '5 columns',
    '6 columns',
    '5 columns',
    '4 columns',
  ],
  'pages.home.publicLanding.officialDataPreview.resultLicenses': [
    'Reuse policy',
    'DL-DE',
    'CC BY',
    'Internal',
  ],
  'pages.home.publicLanding.officialDataPreview.resultSnapshots': [
    '2026-06-30',
    '2026-06-18',
    '2026-07-02',
    '2026-07-10',
  ],
  'pages.home.publicLanding.officialDataPreview.resultDescriptions': [
    'European mobility time series',
    'Official commuter statistics',
    'Open traffic count data',
    'Local sample CSV',
  ],
  'pages.home.publicLanding.officialDataPreview.tableColumns': ['Year', 'Area', 'Value'],
  'pages.home.publicLanding.officialDataPreview.tableRows': [
    '2019|City centre|48',
    '2021|City centre|57',
  ],
  'pages.home.publicLanding.officialDataPreview.chartLabels': [
    '2019',
    '2021',
    '2023',
    '2025',
    '2026',
  ],
  'pages.home.publicLanding.officialDataPreview.areaLabels': [
    'City centre',
    'North',
    'South',
    'East',
    'West',
  ],
};

const labels: Record<string, string> = {
  'pages.home.publicLanding.officialDataPreview.searchLabel': 'Search datasets',
  'pages.home.publicLanding.officialDataPreview.providers.eurostat': 'Eurostat',
  'pages.home.publicLanding.officialDataPreview.providers.destatis': 'GENESIS/Destatis',
  'pages.home.publicLanding.officialDataPreview.providers.govdata': 'GovData',
  'pages.home.publicLanding.officialDataPreview.providers.upload': 'Own data',
  'pages.home.publicLanding.officialDataPreview.useSampleCsv': 'Use sample CSV',
  'pages.home.publicLanding.officialDataPreview.useDataset': 'Use dataset',
  'pages.home.publicLanding.officialDataPreview.changeDataset': 'Change dataset',
  'pages.home.publicLanding.officialDataPreview.views.chart': 'Chart',
  'pages.home.publicLanding.officialDataPreview.views.table': 'Table',
  'pages.home.publicLanding.officialDataPreview.views.stat': 'Statistic',
  'pages.home.publicLanding.officialDataPreview.chartTypes.bar': 'Bar',
  'pages.home.publicLanding.officialDataPreview.chartTypes.line': 'Line',
  'pages.home.publicLanding.officialDataPreview.aggregation': 'Aggregation',
  'pages.home.publicLanding.officialDataPreview.aggregations.mean': 'Mean',
  'pages.home.publicLanding.officialDataPreview.aggregations.sum': 'Sum',
  'pages.home.publicLanding.officialDataPreview.aggregations.max': 'Maximum',
  'pages.home.publicLanding.officialDataPreview.measure': 'Measure',
  'pages.home.publicLanding.officialDataPreview.dimension': 'Dimension',
  'pages.home.publicLanding.officialDataPreview.options.traffic': 'Traffic volume',
  'pages.home.publicLanding.officialDataPreview.options.share': 'Share',
  'pages.home.publicLanding.officialDataPreview.options.year': 'Year',
  'pages.home.publicLanding.officialDataPreview.options.area': 'Area',
};

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'pages.home.publicLanding.officialDataPreview.sourceAttribution') {
        return `Source: ${options?.provider} · ${options?.publisher} · ${options?.date}`;
      }
      return labels[key] ?? key;
    },
    tArray: (key: string) => arrays[key] ?? [],
  }),
}));

afterEach(cleanup);

describe('LandingOfficialDataPreview', () => {
  it('filters local results and builds chart, table, and statistic views', () => {
    const { container } = render(<LandingOfficialDataPreview />);

    const stableActions = [
      'public-landing.official-data.search.change',
      'public-landing.official-data.provider.toggle',
      'public-landing.official-data.sample-csv.select',
      'public-landing.official-data.dataset.select',
    ];
    for (const actionId of stableActions) {
      expect(container.querySelector(`[data-action-id="${actionId}"]`), actionId).not.toBeNull();
    }

    expect(screen.getAllByTestId('landing-dataset-result')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Eurostat' }));
    expect(screen.getAllByTestId('landing-dataset-result')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Search datasets'), {
      target: { value: 'commuter' },
    });
    expect(screen.getAllByTestId('landing-dataset-result')).toHaveLength(1);
    fireEvent.click(screen.getByText('Commuter flows by municipality'));
    expect(screen.getByTestId('landing-dataset-details')).toBeTruthy();

    expect(
      container.querySelector('[data-action-id="public-landing.official-data.dataset.use"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));
    expect(screen.getByTestId('landing-data-builder')).toBeTruthy();
    expect(screen.getByTestId('landing-data-chart-preview')).toBeTruthy();
    expect(screen.getByTestId('landing-data-attribution').textContent).toContain(
      'Federal Statistical Office'
    );

    fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'share' } });
    fireEvent.change(screen.getByLabelText('Dimension'), { target: { value: 'area' } });
    expect(
      container.querySelector('[data-action-id="public-landing.official-data.measure.select"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-action-id="public-landing.official-data.dimension.select"]')
    ).not.toBeNull();
    expect(screen.getByText('32')).toBeTruthy();
    expect(screen.getByText('City centre')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByTestId('landing-data-table-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Statistic' }));
    expect(screen.getByTestId('landing-data-stat-preview')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Aggregation'), { target: { value: 'max' } });
    expect(
      container.querySelector('[data-action-id="public-landing.official-data.aggregation.select"]')
    ).not.toBeNull();
    expect(screen.getByText('60')).toBeTruthy();

    expect(
      container.querySelector('[data-action-id="public-landing.official-data.dataset.change"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change dataset' }));
    expect((screen.getByLabelText('Search datasets') as HTMLInputElement).value).toBe('commuter');
  });

  it('loads the local CSV fixture without a file or network request', () => {
    render(<LandingOfficialDataPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Use sample CSV' }));
    expect(screen.getByTestId('landing-dataset-details').textContent).toContain(
      'Project team mobility count'
    );
  });

  it('exposes stable selectable view and chart-type variants', () => {
    const { container } = render(<LandingOfficialDataPreview />);
    fireEvent.click(screen.getAllByTestId('landing-dataset-result')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));

    const view = container.querySelector<HTMLElement>(
      '[data-action-id="public-landing.official-data.view.select"]'
    );
    const chartType = container.querySelector<HTMLElement>(
      '[data-action-id="public-landing.official-data.chart-type.select"]'
    );
    expect(view).not.toBeNull();
    expect(chartType).not.toBeNull();
    view!.focus();
    expect(document.activeElement).toBe(view);
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByTestId('landing-data-table-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Line' }));
    expect(screen.getByTestId('landing-data-chart-preview')).toBeTruthy();
  });
});
