import { describe, expect, it } from 'vitest';
import {
  datasetDescriptionText,
  getDatasetTopicQueries,
  interpretDatasetSearch,
  normalizeDatasetCoverage,
  parseDatasetSearchFilters,
  rankDatasetSearchResults,
} from '../datasetSearch';
import type { DatasetSearchResult } from '../../types';

function result(id: string, overrides: Partial<DatasetSearchResult> = {}): DatasetSearchResult {
  return { id, provider: 'GOVDATA', providerDatasetId: id, title: 'Arbeitslose', ...overrides };
}
const local = result('recklinghausen', {
  title: '2023-2025_Arbeitslose_Gesamt_RE',
  publisher: 'Recklinghausen',
  description:
    '#Inhalt: Arbeitslosenzahlen für Recklinghausen gesamt\n##Datenstand: 31.12.2023, 31.12.2024, 31.12.2025\n###Quelle: Bundesagentur für Arbeit',
});
const national = result('national', {
  provider: 'GENESIS_DESTATIS',
  title: 'Arbeitslose: Deutschland, Jahre',
  timeCoverage: { start: '2020', end: '2025' },
  spatialCoverage: ['Deutschland'],
});

describe('dataset search intent', () => {
  it('prioritizes the GENESIS catalogue language even when the input uses another language', () => {
    expect(
      getDatasetTopicQueries(interpretDatasetSearch('Arbeitslose 2025 Deutschland'), 'en')[0]
    ).toBe('unemployment');
    expect(getDatasetTopicQueries(interpretDatasetSearch('Population 2025 Germany'), 'de')[0]).toBe(
      'Bevölkerung'
    );
    expect(
      getDatasetTopicQueries(interpretDatasetSearch('Inflation 2025 Deutschland'), 'en')[0]
    ).toBe('HICP');
    expect(getDatasetTopicQueries(interpretDatasetSearch('12411-0001'), 'en')).toEqual([
      '12411-0001',
    ]);
  });
  it('reaches official price index names within the three-query budget', () => {
    expect(getDatasetTopicQueries(interpretDatasetSearch('Inflation 2025 Deutschland'))).toEqual([
      'Verbraucherpreisindex',
      'HICP',
      'Inflation',
    ]);
    const ranked = rankDatasetSearchResults(
      [
        result('unrelated', {
          title: 'Population',
          spatialCoverage: ['Deutschland'],
          timeCoverage: { start: '2020', end: '2025' },
        }),
        result('index', {
          title: 'HICP - monthly data (index)',
          spatialCoverage: ['Germany'],
          timeCoverage: { start: '2000', end: '2025' },
        }),
        result('national-index', {
          title: 'Verbraucherpreisindex: Deutschland, Jahre',
          timeCoverage: { start: '1991', end: '2025' },
        }),
      ],
      interpretDatasetSearch('Inflation 2025 Deutschland')
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.every(item => item.searchMatch?.group === 'matching')).toBe(true);
  });
  it.each([
    ['Arbeitslose 2025 Deutschland', 'Arbeitslose', 'Deutschland', 2025, 2025],
    ['unemployment 2023–2025 Germany', 'unemployment', 'Deutschland', 2023, 2025],
    ['Bevölkerung Nordrhein-Westfalen 2024', 'Bevölkerung', 'Nordrhein-Westfalen', 2024, 2024],
    ['Inflation Sachsen-Anhalt', 'Inflation', 'Sachsen-Anhalt', undefined, undefined],
    ['GDP Bavaria', 'GDP', 'Bayern', undefined, undefined],
    [
      'Arbeitslose 2023 bis 2025 Bundesrepublik Deutschland',
      'Arbeitslose',
      'Deutschland',
      2023,
      2025,
    ],
    [
      'unemployment 2023 to 2025 Federal Republic of Germany',
      'unemployment',
      'Deutschland',
      2023,
      2025,
    ],
  ])('interprets %s', (query, topic, area, start, end) => {
    const intent = interpretDatasetSearch(query);
    expect(intent.topic).toBe(topic);
    expect(intent.area).toBe(area);
    expect(intent.period).toEqual(start ? { start, end } : null);
  });
  it.each([
    'Baden-Württemberg',
    'Bayern',
    'Berlin',
    'Brandenburg',
    'Bremen',
    'Hamburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen',
  ])('recognizes %s', area => {
    expect(interpretDatasetSearch(`Arbeitslose ${area}`).area).toBe(area);
  });
  it('keeps ambiguous and unknown locations as text, while manual filters override and null disables detection', () => {
    expect(interpretDatasetSearch('Arbeitslose Deutschland Bayern').area).toBeNull();
    expect(interpretDatasetSearch('Arbeitslose Recklinghausen').topic).toContain('Recklinghausen');
    expect(
      interpretDatasetSearch('Arbeitslose 2025 Deutschland', { area: null, period: null })
    ).toMatchObject({ topic: 'Arbeitslose', area: null, period: null });
    expect(
      interpretDatasetSearch('Arbeitslose 2025 Deutschland', {
        area: 'Recklinghausen',
        period: { start: 2023, end: 2024 },
      })
    ).toMatchObject({
      topic: 'Arbeitslose',
      area: 'Recklinghausen',
      period: { start: 2023, end: 2024 },
    });
  });
  it.each(['une_rt_a', '13211-0001', '05d00e97-a647-4fc2-abde-da231c5c903b'])(
    'preserves exact code %s',
    code => {
      expect(interpretDatasetSearch(code)).toMatchObject({
        topic: code,
        isCode: true,
        area: null,
        period: null,
      });
      expect(getDatasetTopicQueries(interpretDatasetSearch(code))).toEqual([code]);
    }
  );
  it('keeps variants bounded and distinguishes numbers from rates', () => {
    expect(getDatasetTopicQueries(interpretDatasetSearch('Arbeitslose 2025 Deutschland'))).toEqual([
      'Arbeitslose',
      'Arbeitslosigkeit',
      'unemployment',
    ]);
    expect(getDatasetTopicQueries(interpretDatasetSearch('Arbeitslosenquote 2025'))).toEqual([
      'Arbeitslosenquote',
      'unemployment rate',
    ]);
    expect(getDatasetTopicQueries(interpretDatasetSearch('Bevoelkerung'))).toContain('Bevölkerung');
    expect(
      getDatasetTopicQueries(interpretDatasetSearch('gross national product Germany'))
    ).toEqual(['gross national product', 'Bruttonationalprodukt', 'GNP']);
    expect(
      getDatasetTopicQueries(interpretDatasetSearch('Arbeitslosenzahlen 2025 Deutschland'))
    ).toContain('unemployment');
    expect(getDatasetTopicQueries(interpretDatasetSearch('Arbeitslosenstatistik'))).toContain(
      'unemployment'
    );
  });
  it.each([
    null,
    [],
    { area: '' },
    { area: 'x'.repeat(121) },
    { period: { start: 2025, end: 2023 } },
    { period: { start: 2025.5, end: 2026 } },
    { period: { start: 1700, end: 2025 } },
  ])('rejects invalid filters %j', value => {
    expect(() => parseDatasetSearchFilters(value)).toThrow();
  });
});

describe('dataset search relevance and coverage', () => {
  it('ranks nationwide data before the reported municipal dataset and incidental income mentions', () => {
    const income = result('income', {
      title: 'Nettoäquivalenzeinkommen: Deutschland, Jahre',
      description: 'Erwerbsstatus: Arbeitslose',
      timeCoverage: { start: '2020', end: '2025' },
      spatialCoverage: ['Deutschland'],
    });
    const ranked = rankDatasetSearchResults(
      [local, income, national],
      interpretDatasetSearch('Arbeitslose 2025 Deutschland')
    );
    expect(ranked[0].id).toBe('national');
    expect(ranked[0].searchMatch?.group).toBe('matching');
    expect(ranked.find(item => item.id === 'recklinghausen')?.searchMatch).toMatchObject({
      group: 'other',
      area: { status: 'different', label: 'Recklinghausen', source: 'text' },
      period: { status: 'match', start: 2023, end: 2025, source: 'text' },
    });
    expect(ranked.find(item => item.id === 'income')?.searchMatch?.group).toBe('other');
  });
  it('allows the municipal dataset for a topic and year without a requested country', () => {
    expect(
      rankDatasetSearchResults([local], interpretDatasetSearch('Arbeitslose 2025'))[0].searchMatch
        ?.group
    ).toBe('matching');
  });
  it('ignores publisher, licenses, and update dates as coverage evidence', () => {
    const data = result('unknown', {
      publisher: 'Statistisches Bundesamt Deutschland',
      license: 'Datenlizenz Deutschland',
      modified: '2025-12-31',
      description: 'Copyright 2025 Deutschland',
    });
    const ranked = rankDatasetSearchResults(
      [data],
      interpretDatasetSearch('Arbeitslose 2025 Deutschland')
    )[0];
    expect(ranked.searchMatch).toMatchObject({
      group: 'other',
      area: { status: 'unknown' },
      period: { status: 'unknown' },
    });
    expect(
      rankDatasetSearchResults(
        [result('published', { title: 'Arbeitslose - Veröffentlichung 2025' })],
        interpretDatasetSearch('Arbeitslose 2025')
      )[0].searchMatch?.period.status
    ).toBe('unknown');
  });
  it('prefers structured coverage over contradictory text and avoids assuming missing years', () => {
    const structured = result('structured', {
      title: 'Arbeitslose Deutschland 2025',
      spatialCoverage: ['Berlin'],
      timeCoverage: { start: '2020', end: '2021' },
    });
    expect(
      rankDatasetSearchResults(
        [structured],
        interpretDatasetSearch('Arbeitslose 2025 Deutschland')
      )[0].searchMatch
    ).toMatchObject({
      area: { status: 'different', source: 'metadata' },
      period: { status: 'different', source: 'metadata' },
    });
    const sparse = result('sparse', { description: 'Datenstand: 2023, 2025' });
    expect(
      rankDatasetSearchResults([sparse], interpretDatasetSearch('Arbeitslose 2024'))[0].searchMatch
        ?.period.status
    ).toBe('unknown');
    expect(() =>
      normalizeDatasetCoverage(result('bad', { title: 'Arbeitslose 2025-2023' }))
    ).not.toThrow();
  });
  it('keeps unknown and out-of-range results honest and excludes unrelated topics', () => {
    const outOfRange = {
      ...national,
      id: 'old',
      providerDatasetId: 'old',
      timeCoverage: { start: '2010', end: '2020' },
    };
    const otherTopic = result('weather', { title: 'Wetter Deutschland 2025' });
    const ranked = rankDatasetSearchResults(
      [otherTopic, outOfRange, result('unknown')],
      interpretDatasetSearch('Arbeitslose 2025 Deutschland')
    );
    expect(ranked.map(item => item.id)).not.toContain('weather');
    expect(ranked.every(item => item.searchMatch?.group === 'other')).toBe(true);
  });
  it('deduplicates provider resources, retaining editable stored snapshots, and sorts ties stably', () => {
    const stored = { ...national, id: 'stored', snapshotId: 'snapshot' };
    expect(
      rankDatasetSearchResults([national, stored], interpretDatasetSearch('Arbeitslose'))
    ).toHaveLength(1);
    expect(
      rankDatasetSearchResults([national, stored], interpretDatasetSearch('Arbeitslose'))[0]
        .snapshotId
    ).toBe('snapshot');
    const tied = [result('b'), result('a')];
    expect(
      rankDatasetSearchResults(tied, interpretDatasetSearch('Arbeitslose')).map(item => item.id)
    ).toEqual(['a', 'b']);
  });
  it('ranks exact dataset codes even when the title is unrelated to the code', () => {
    const coded = result('code', {
      providerDatasetId: 'une_rt_a',
      title: 'Annual unemployment rate',
    });
    expect(rankDatasetSearchResults([coded], interpretDatasetSearch('une_rt_a'))[0].id).toBe(
      'code'
    );
  });
  it('shows counts before related unemployment rates', () => {
    const rate = result('rate', { title: 'Arbeitslosenquote Deutschland 2025' });
    expect(
      rankDatasetSearchResults([rate, national], interpretDatasetSearch('Arbeitslose'))[0].id
    ).toBe('national');
    expect(
      rankDatasetSearchResults(
        [result('both', { title: 'Arbeitslose und Arbeitslosenquote' })],
        interpretDatasetSearch('Arbeitslose')
      )[0].searchMatch?.group
    ).toBe('matching');
  });
  it('recognizes an explicit coverage line but not an incidental country mention', () => {
    const explicit = result('explicit', {
      description: 'Gebiet: Deutschland\nDatenzeitraum: 2023–2025',
    });
    expect(
      rankDatasetSearchResults(
        [explicit],
        interpretDatasetSearch('Arbeitslose 2025 Deutschland')
      )[0].searchMatch
    ).toMatchObject({ group: 'matching', area: { source: 'text' }, period: { source: 'text' } });
    expect(
      normalizeDatasetCoverage(
        result('incidental', { description: 'Herausgeber in Deutschland, veröffentlicht 2025' })
      ).spatialCoverage
    ).toBeUndefined();
  });
  it('produces safe plain text excerpts without markdown headings', () => {
    expect(
      datasetDescriptionText('#Inhalt: <b>Arbeitslose</b>\n##Quelle: [BA](https://example.org)')
    ).toBe('Inhalt:  Arbeitslose \nQuelle: BA');
  });
});
