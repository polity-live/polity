import { afterEach, expect, it, vi } from 'vitest';
import { getEurostatDatasetMetadata, getEurostatConstraintRegions } from '../metadata';
import type { EurostatCatalogueEntry } from '@/features/charts/types';

const entry: EurostatCatalogueEntry = {
  code: 'EXAMPLE',
  title: 'Population',
  type: 'dataset',
  lastUpdate: '2026-10-01',
  structureLastChange: null,
  dataStart: '2000',
  dataEnd: '2025',
  valueCount: 10,
};
const structure = `<message:Structure xmlns:message="m"><Structures><Codelists><Codelist id="CL_GEO"><Name xml:lang="en">Area</Name><Code id="DE"><Name xml:lang="en">Germany</Name></Code><Code id="FR"><Name xml:lang="en">France</Name></Code></Codelist></Codelists><DataStructures><DataStructure><DataStructureComponents><DimensionList><Dimension id="geo" position="1"><LocalRepresentation><Enumeration><Ref id="CL_GEO" /></Enumeration></LocalRepresentation></Dimension><TimeDimension id="TIME_PERIOD" position="2" /></DimensionList></DataStructureComponents></DataStructure></DataStructures></Structures></message:Structure>`;
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['2025-00', '2025-01'],
  ['2025-13', '2026-01'],
  ['bad', '2025'],
  ['2025', undefined],
  ['2025', '2025-Q2'],
  ['2026', '2025'],
  ['2025-99-99', '2026-01-01'],
])('does not manufacture observations for invalid time constraints %s to %s', (start, end) => {
  const constraint = {
    Structure: {
      Structures: {
        Constraints: {
          ContentConstraint: { CubeRegion: { TimeRange: { StartPeriod: start, EndPeriod: end } } },
        },
      },
    },
  };
  expect(getEurostatConstraintRegions(constraint)[0].values.TIME_PERIOD).toEqual([]);
});

it.each([
  ['2024-12', '2025-02', ['2024-12', '2025-01', '2025-02']],
  ['2024-Q4', '2025-Q2', ['2024-Q4', '2025-Q1', '2025-Q2']],
  ['2024-12-31', '2025-01-02', ['2024-12-31', '2025-01-01', '2025-01-02']],
])('retains valid period keys from %s through %s', (start, end, expected) => {
  const constraint = {
    Structure: {
      Structures: {
        Constraints: {
          ContentConstraint: { CubeRegion: { TimeRange: { StartPeriod: start, EndPeriod: end } } },
        },
      },
    },
  };
  expect(getEurostatConstraintRegions(constraint)[0].values.TIME_PERIOD).toEqual(expected);
});

it('honors exclusive time boundaries instead of inventing available observations', () => {
  const constraint = {
    Structure: {
      Structures: {
        Constraints: {
          ContentConstraint: {
            CubeRegion: {
              TimeRange: {
                StartPeriod: { '#text': '2024', '@_isInclusive': 'false' },
                EndPeriod: { '#text': '2026', '@_isInclusive': 'false' },
              },
            },
          },
        },
      },
    },
  };
  expect(getEurostatConstraintRegions(constraint)[0].values.TIME_PERIOD).toEqual(['2025']);
});

it('does not infer Germany availability from a global codelist and never samples CSV during metadata loading', async () => {
  const constraint = `<Structure><Structures><Constraints><ContentConstraint><CubeRegion include="true"><KeyValue id="geo"><Value>FR</Value></KeyValue><KeyValue id="TIME_PERIOD"><Value>2025</Value></KeyValue></CubeRegion></ContentConstraint></Constraints></Structures></Structure>`;
  const fetcher = vi.fn(
    async (url: string) => new Response(url.includes('datastructure') ? structure : constraint)
  );
  vi.stubGlobal('fetch', fetcher);
  const details = await getEurostatDatasetMetadata('EXAMPLE', 'en', undefined, entry);
  expect(details.dimensions.find(item => item.id === 'geo')?.values).toEqual([
    { id: 'FR', label: 'France' },
  ]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([url]) => !url.includes('/data/dataflow/'))).toBe(true);
});

it('preserves several content constraints, correlated regions, exclusions and explicit time ranges', async () => {
  const constraint = `<Structure><Structures><Constraints><ContentConstraint><CubeRegion include="true"><KeyValue id="geo"><Value>DE</Value></KeyValue><TimeRange><StartPeriod>2024</StartPeriod><EndPeriod>2025</EndPeriod></TimeRange></CubeRegion><CubeRegion include="false"><KeyValue id="geo"><Value>DE</Value></KeyValue><KeyValue id="TIME_PERIOD"><Value>2025</Value></KeyValue></CubeRegion></ContentConstraint><ContentConstraint><CubeRegion include="true"><KeyValue id="geo"><Value>FR</Value></KeyValue><KeyValue id="TIME_PERIOD"><Value>2023</Value></KeyValue></CubeRegion></ContentConstraint></Constraints></Structures></Structure>`;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) => new Response(url.includes('datastructure') ? structure : constraint)
    )
  );
  const details = await getEurostatDatasetMetadata('EXAMPLE', 'en', undefined, entry);
  expect(details.dimensions.find(item => item.id === 'geo')?.values.map(item => item.id)).toEqual([
    'DE',
    'FR',
  ]);
  expect(details.coverageRegions).toEqual([
    { included: true, values: { geo: ['DE'], TIME_PERIOD: ['2024', '2025'] } },
    { included: false, values: { geo: ['DE'], TIME_PERIOD: ['2025'] } },
    { included: true, values: { geo: ['FR'], TIME_PERIOD: ['2023'] } },
  ]);
});
