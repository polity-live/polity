import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeGovDataPackage } from '../catalogue';
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
