import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isGovDataCsvResource,
  loadGovDataPackage,
  normalizeGovDataFormat,
  normalizeGovDataPackage,
  normalizeGovDataText,
  searchGovDataCatalogue,
} from '../catalogue';
import { parseGovDataCsvTable } from '../csv';
import { createGovDataCsvSnapshot } from '../importer';
import { assertSafePublicHttpUrl } from '../safety';

describe('GovData utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes packages and keeps only importable CSV resources', () => {
    const entry = normalizeGovDataPackage({
      id: 'pkg-1',
      name: 'arbeitslosigkeit',
      title: 'Arbeitslosigkeit',
      maintainer: 'Statistisches Amt',
      organization: { title: 'Open Data BW' },
      resources: [
        {
          id: 'csv-1',
          name: 'Arbeitslosigkeit CSV',
          format: 'http://publications.europa.eu/resource/authority/file-type/CSV',
          mimetype: 'text/csv',
          size: '1024',
          url: 'https://example.com/data.csv',
        },
        {
          id: 'pdf-1',
          name: 'Documentation',
          format: 'PDF',
          mimetype: 'application/pdf',
          url: 'https://example.com/doc.pdf',
        },
      ],
    });

    expect(entry?.resources).toHaveLength(1);
    expect(entry?.resources[0]).toMatchObject({
      id: 'csv-1',
      format: 'CSV',
      size: 1024,
    });
  });

  it('turns CKAN HTML descriptions into readable plain text', () => {
    const description = normalizeGovDataText(
      '<p>Anzahl der Arbeitslosen in den statistischen Bezirken.</p>' +
        '<p><strong>Hinweis</strong>: Die Abkürzungen stehen im ' +
        '<a href="https://example.com"><u>Merkmalskatalog</u></a>.</p>' +
        '<p>Werte für Darmstadt &amp; Umgebung.</p>'
    );

    expect(description).toBe(
      'Anzahl der Arbeitslosen in den statistischen Bezirken.\n\n' +
        'Hinweis: Die Abkürzungen stehen im Merkmalskatalog.\n\n' +
        'Werte für Darmstadt & Umgebung.'
    );
    expect(description).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  it('normalizes HTML in catalogue metadata fields', () => {
    const entry = normalizeGovDataPackage({
      id: 'pkg-html',
      name: 'arbeitslosigkeit',
      title: '<strong>Arbeitslosigkeit 2025 Q2</strong>',
      notes: '<p>Arbeitslose je statistischem Bezirk.</p>',
      maintainer: '<span>Wissenschaftsstadt Darmstadt</span>',
      organization: { title: '<b>GovData</b>' },
      resources: [
        {
          id: 'csv-html',
          name: '<em>Arbeitslosigkeit 2025 Q2</em>',
          format: 'CSV',
          url: 'https://example.com/data.csv',
        },
      ],
    });

    expect(entry).toMatchObject({
      title: 'Arbeitslosigkeit 2025 Q2',
      notes: 'Arbeitslose je statistischem Bezirk.',
      publisher: 'Wissenschaftsstadt Darmstadt',
      organizationTitle: 'GovData',
    });
    expect(entry?.resources[0]?.name).toBe('Arbeitslosigkeit 2025 Q2');
  });

  it('normalizes empty text, URI formats, MIME fallbacks and resource URL variants', () => {
    expect(normalizeGovDataText(null)).toBe('');
    expect(normalizeGovDataText('<br><table><tr><td>One</td><td>Two</td></tr></table>')).toBe(
      'One\nTwo'
    );
    expect(normalizeGovDataFormat('https://example.test/types#csv')).toBe('CSV');
    expect(normalizeGovDataFormat('', 'text/csv')).toBe('CSV');
    expect(normalizeGovDataFormat(null, 'application/json')).toBe('');
    expect(isGovDataCsvResource({ download_url: 'https://example.test/data.csv?x=1' })).toBe(true);
    expect(
      isGovDataCsvResource({ access_url: 'https://example.test/data', mimetype: 'text/csv' })
    ).toBe(true);
    expect(isGovDataCsvResource({ url: 'https://example.test/data.json', format: 'JSON' })).toBe(
      false
    );
  });

  it('rejects incomplete packages and applies sparse resource metadata fallbacks', () => {
    expect(normalizeGovDataPackage({ name: 'missing-id', resources: [] })).toBeNull();
    expect(normalizeGovDataPackage({ id: 'id', name: '', resources: [] })).toBeNull();
    expect(normalizeGovDataPackage({ id: 'id', name: 'name', resources: [] })).toBeNull();
    expect(normalizeGovDataPackage({ id: 'id', name: 'name', resources: null })).toBeNull();
    expect(
      normalizeGovDataPackage({
        id: 'id',
        name: 'name',
        organization: { name: 'Organization' },
        extras: [{ key: 'publisher_name', value: 'Publisher' }],
        metadata_modified: '2025-01-01',
        resources: [
          { id: null, url: 'https://example.test/a.csv', format: 'CSV' },
          { id: 'missing-url', format: 'CSV' },
          { id: 'not-csv', url: 'https://example.test/a.json', format: 'JSON' },
          {
            id: 'csv',
            description: 'Description fallback',
            mimetype: 'text/csv',
            size: 'invalid',
            access_url: 'https://example.test/a',
            last_modified: '2025-02-01',
          },
        ],
      })
    ).toMatchObject({
      title: 'name',
      publisher: 'Publisher',
      organizationTitle: 'Organization',
      modified: '2025-01-01',
      resources: [
        {
          id: 'csv',
          name: 'Description fallback',
          format: 'CSV',
          size: null,
          modified: '2025-02-01',
        },
      ],
    });

    expect(
      normalizeGovDataPackage({
        id: 'url-csv',
        name: 'url-csv',
        resources: [{ id: 'csv', url: 'https://example.test/data.csv' }],
      })?.resources[0]?.format
    ).toBe('CSV');
  });

  it('handles short search, HTTP failures, CKAN failures and successful search/show calls', async () => {
    await expect(searchGovDataCatalogue(' x ')).resolves.toEqual([]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(searchGovDataCatalogue('data')).rejects.toThrow(
      'GovData package_search request failed with 503'
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: false, error: { message: 'CKAN failed' } })
    );
    await expect(searchGovDataCatalogue('data')).rejects.toThrow('CKAN failed');
    fetchMock.mockResolvedValueOnce(Response.json({ success: false }));
    await expect(loadGovDataPackage('package-1')).rejects.toThrow(
      'GovData package_show request failed'
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({
        success: true,
        result: {
          results: [
            {
              id: 'one',
              name: 'one',
              resources: [{ id: 'csv', url: 'https://example.test/one.csv', format: 'CSV' }],
            },
            { id: 'invalid', name: 'invalid', resources: [] },
            {
              id: 'two',
              name: 'two',
              resources: [{ id: 'csv', url: 'https://example.test/two.csv', format: 'CSV' }],
            },
          ],
        },
      })
    );
    await expect(searchGovDataCatalogue(' data ', 1)).resolves.toHaveLength(1);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('q=data');
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, result: { id: 'package-1' } }));
    await expect(loadGovDataPackage('package-1')).resolves.toEqual({ id: 'package-1' });
  });

  it('parses semicolon separated GovData CSV files', () => {
    const table = parseGovDataCsvTable('Jahr;Wert\n2024;42\n2025;51\n');

    expect(table.columns).toEqual(['Jahr', 'Wert']);
    expect(table.rows).toEqual([
      { Jahr: '2024', Wert: '42' },
      { Jahr: '2025', Wert: '51' },
    ]);
  });

  it('rejects local and private resource URLs', () => {
    expect(() => assertSafePublicHttpUrl('http://localhost/data.csv')).toThrow(
      'GovData resource URL is not public'
    );
    expect(() => assertSafePublicHttpUrl('http://127.0.0.1/data.csv')).toThrow(
      'GovData resource URL is not public'
    );
    expect(() => assertSafePublicHttpUrl('file:///tmp/data.csv')).toThrow(
      'Only HTTP(S) GovData resources can be imported'
    );
  });

  it('imports a verified CSV resource into a chart table snapshot', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            id: 'pkg-1',
            name: 'arbeitslosigkeit',
            title: 'Arbeitslosigkeit',
            license_title: 'DL-DE BY 2.0',
            organization: { title: 'Open Data BW' },
            resources: [
              {
                id: 'res-1',
                name: 'Zeitreihe',
                format: 'CSV',
                mimetype: 'text/csv',
                modified: '2026-01-01T00:00:00Z',
                url: 'https://example.com/data.csv',
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        new Response('Jahr;Wert\n2024;42\n', {
          headers: { 'content-type': 'text/csv' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createGovDataCsvSnapshot('pkg-1', 'res-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.columns).toEqual(['Jahr', 'Wert']);
    expect(result.rows).toEqual([{ Jahr: '2024', Wert: '42' }]);
    expect(result.snapshotKey).toHaveLength(64);
    expect(result.provenance).toMatchObject({
      packageId: 'pkg-1',
      resourceId: 'res-1',
      packageTitle: 'Arbeitslosigkeit',
      licenseTitle: 'DL-DE BY 2.0',
    });
  });

  it('rejects unsafe resource URLs during import', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            id: 'pkg-1',
            name: 'internal',
            title: 'Internal',
            resources: [
              {
                id: 'res-1',
                name: 'Internal CSV',
                format: 'CSV',
                url: 'http://127.0.0.1/data.csv',
              },
            ],
          },
        })
      )
    );

    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow(
      'GovData resource URL is not public'
    );
  });
});
