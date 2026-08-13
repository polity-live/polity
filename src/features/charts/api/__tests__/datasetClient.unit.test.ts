import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiveDataset,
  createDataViewProjection,
  createProviderSnapshot,
  loadDatasetColumnValues,
  loadDatasetDetails,
  searchDatasetCatalog,
  searchDatasets,
  uploadDataset,
} from '../datasetClient';

const fetchMock = vi.fn();

function response(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('dataset client contracts', () => {
  it('encodes search filters and authentication for result and catalog searches', async () => {
    fetchMock
      .mockResolvedValueOnce(response([{ id: 'dataset-1' }]))
      .mockResolvedValueOnce(response({ results: [], providers: [] }));

    await expect(
      searchDatasets({
        query: 'population & age',
        providers: ['EUROSTAT', 'GOVDATA'],
        groupId: 'group/1',
        language: 'de',
        accessToken: 'token',
        includeExternal: true,
      })
    ).resolves.toEqual([{ id: 'dataset-1' }]);
    const [searchUrl, searchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(searchUrl).toContain('q=population+%26+age');
    expect(searchUrl).toContain('providers=EUROSTAT%2CGOVDATA');
    expect(searchUrl).toContain('groupId=group%2F1');
    expect(searchUrl).toContain('includeExternal=true');
    expect(new Headers(searchInit.headers).get('Authorization')).toBe('Bearer token');

    await searchDatasetCatalog({
      query: 'transport',
      providers: [],
      groupId: 'group-1',
      language: 'en',
    });
    const [catalogUrl, catalogInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(catalogUrl).toContain('withStatus=true');
    expect(catalogUrl).toContain('includeExternal=true');
    expect(new Headers(catalogInit.headers).has('Authorization')).toBe(false);
  });

  it('omits every optional search filter and independently authenticates catalog search', async () => {
    fetchMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ results: [], errors: [] }));

    await searchDatasets({ query: 'plain', providers: [] });
    const [searchUrl, searchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(searchUrl).toBe('/api/datasets/search?q=plain');
    expect(new Headers(searchInit.headers).has('Authorization')).toBe(false);

    await searchDatasetCatalog({
      query: 'catalog',
      providers: ['EUROSTAT'],
      accessToken: 'token',
    });
    const [catalogUrl, catalogInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(catalogUrl).toContain('providers=EUROSTAT');
    expect(catalogUrl).not.toContain('groupId=');
    expect(catalogUrl).not.toContain('lang=');
    expect(catalogUrl).not.toContain('includeExternal=');
    expect(new Headers(catalogInit.headers).get('Authorization')).toBe('Bearer token');
  });

  it('uses exact JSON request boundaries for imports, projections, values, details, and archive', async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));

    await createProviderSnapshot(
      { provider: 'EUROSTAT', code: 'demo_r_pjanaggr3', language: 'de' },
      'token'
    );
    await createDataViewProjection(
      { snapshotId: 'snapshot/1', view: 'table', filters: {}, aggregation: 'count' },
      'token'
    );
    await loadDatasetColumnValues('snapshot/1', 'region & year', 'Berlin', 'token');
    await loadDatasetDetails('dataset/1');
    await archiveDataset('dataset/1', 'token');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/datasets/snapshots');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      provider: 'EUROSTAT',
      language: 'de',
    });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/datasets/snapshot%2F1/projection');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('snapshotId');
    expect(fetchMock.mock.calls[2][0]).toContain('/api/datasets/snapshot%2F1/values?');
    expect(fetchMock.mock.calls[2][0]).toContain('column=region+%26+year');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/datasets/dataset%2F1/details');
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ datasetId: 'dataset/1' });
  });

  it('uploads optional metadata as form data and converts failed responses to app errors', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ id: 'snapshot-1' }))
      .mockResolvedValueOnce(response({ error: { code: 'forbidden', message: 'Denied' } }, false));
    const file = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' });

    await uploadDataset(
      {
        file,
        groupId: 'group-1',
        title: 'Population',
        description: 'Annual data',
      },
      'token'
    );
    const uploadInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = uploadInit.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('groupId')).toBe('group-1');
    expect(body.get('title')).toBe('Population');
    expect(body.get('description')).toBe('Annual data');
    expect(new Headers(uploadInit.headers).get('Content-Type')).toBeNull();

    await expect(archiveDataset('dataset-1')).rejects.toMatchObject({
      payload: { code: 'dataset_operation_failed' },
    });
  });

  it('omits optional upload metadata and uses default value-search arguments without auth', async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));
    const file = new File(['x'], 'minimal.csv', { type: 'text/csv' });

    await uploadDataset({ file, groupId: 'group-1' });
    const uploadInit = fetchMock.mock.calls[0][1] as RequestInit;
    const form = uploadInit.body as FormData;
    expect(form.has('title')).toBe(false);
    expect(form.has('description')).toBe(false);
    expect(new Headers(uploadInit.headers).has('Authorization')).toBe(false);

    await loadDatasetColumnValues('snapshot', 'region');
    const [valuesUrl, valuesInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(valuesUrl).toContain('q=&limit=50');
    expect(new Headers(valuesInit.headers).has('Authorization')).toBe(false);

    await loadDatasetDetails('dataset', 'token');
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe(
      'Bearer token'
    );
  });
});
