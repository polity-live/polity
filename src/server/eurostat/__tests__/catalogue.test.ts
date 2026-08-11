import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function response(text: string, options: { ok?: boolean; status?: number } = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: vi.fn(async () => text),
  };
}

function catalogueTsv(rows: string[]) {
  return [
    'type\tcode\ttitle\tlast update of data\tlast table structure change\tdata start\tdata end\tvalues',
    ...rows,
  ].join('\n');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getEurostatCatalogue', () => {
  it('parses, normalizes, filters, and deduplicates real TSV catalogue rows', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        catalogueTsv([
          'dataset\t abc \tOld title\t 2026-01-01 \t \t2000\t2025\t10',
          'table\tabc\tCurrent title\t\t2026-02-01\t\t\tnot-a-number',
          'folder\tIGNORED\tFolder\t\t\t\t\t1',
          'dataset\t\tMissing code\t\t\t\t\t1',
          'table\tNO_TITLE\t\t\t\t\t\t1',
          'dataset',
          'dataset\tSHORT\tShort dataset',
          'dataset\tdef\tSecond dataset\t2026-03-01\t2026-03-02\t2010\t2024\t25',
        ])
      ) as never
    );
    const { getEurostatCatalogue } = await import('../catalogue');

    const result = await getEurostatCatalogue('de');

    expect(result).toEqual([
      {
        code: 'ABC',
        title: 'Current title',
        type: 'table',
        lastUpdate: null,
        structureLastChange: '2026-02-01',
        dataStart: null,
        dataEnd: null,
        valueCount: 0,
      },
      {
        code: 'SHORT',
        title: 'Short dataset',
        type: 'dataset',
        lastUpdate: null,
        structureLastChange: null,
        dataStart: null,
        dataEnd: null,
        valueCount: 0,
      },
      {
        code: 'DEF',
        title: 'Second dataset',
        type: 'dataset',
        lastUpdate: '2026-03-01',
        structureLastChange: '2026-03-02',
        dataStart: '2010',
        dataEnd: '2024',
        valueCount: 25,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('lang=de'));
    await expect(getEurostatCatalogue('de')).resolves.toBe(result);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('normalizes unsupported languages and refreshes expired cache entries', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(catalogueTsv(['dataset\tONE\tFirst\t\t\t\t\t1'])) as never)
      .mockResolvedValueOnce(response(catalogueTsv(['dataset\tTWO\tSecond\t\t\t\t\t2'])) as never);
    const { getEurostatCatalogue } = await import('../catalogue');

    await expect(getEurostatCatalogue('unsupported')).resolves.toMatchObject([{ code: 'ONE' }]);
    now.mockReturnValue(1_000 + 10 ** 9);
    await expect(getEurostatCatalogue('en')).resolves.toMatchObject([{ code: 'TWO' }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('lang=en'));
  });

  it('reports failed HTTP responses with their status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response('', { ok: false, status: 503 }) as never);
    const { getEurostatCatalogue } = await import('../catalogue');
    await expect(getEurostatCatalogue('fr')).rejects.toThrow(
      'Eurostat catalogue request failed with 503'
    );
  });
});

describe('catalogue search and lookup', () => {
  it('scores every match category and applies value/title tie breakers and limits', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        catalogueTsv([
          'dataset\tAB\tExact\t\t\t\t\t1',
          'dataset\tAB2\tCode start lower\t\t\t\t\t5',
          'dataset\tAB1\tCode start higher\t\t\t\t\t10',
          'dataset\tZZ1\tAb title Z\t\t\t\t\t7',
          'dataset\tZZ2\tAb title A\t\t\t\t\t7',
          'dataset\tXABX\tCode contains\t\t\t\t\t100',
          'dataset\tTITLE\tSomething ab inside\t\t\t\t\t100',
          'dataset\tNONE\tUnrelated\t\t\t\t\t100',
        ])
      ) as never
    );
    const { searchEurostatCatalogue } = await import('../catalogue');

    await expect(searchEurostatCatalogue('a')).resolves.toEqual([]);
    const result = await searchEurostatCatalogue('  Ab  ', 'en', 6);
    expect(result.map(entry => entry.code)).toEqual(['AB', 'AB1', 'AB2', 'ZZ2', 'ZZ1', 'XABX']);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('finds normalized codes and rejects missing datasets from the cached catalogue', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(catalogueTsv(['dataset\tDEMO\tDemo dataset\t\t\t\t\t1'])) as never
    );
    const { findEurostatCatalogueEntry } = await import('../catalogue');

    await expect(findEurostatCatalogueEntry(' demo ')).resolves.toMatchObject({ code: 'DEMO' });
    await expect(findEurostatCatalogueEntry('missing')).rejects.toThrow(
      'Eurostat dataset MISSING was not found'
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});
