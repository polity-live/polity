import type {
  DataViewProjection,
  DataViewProjectionRequest,
  DatasetProviderId,
  DatasetProviderSearchResponse,
  DatasetSearchResult,
  DatasetSnapshotImportResult,
} from '../types';

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body;
}

function authHeaders(accessToken?: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export async function searchDatasets({
  query,
  providers,
  groupId,
  language,
  accessToken,
  includeExternal,
}: {
  query: string;
  providers: readonly DatasetProviderId[];
  groupId?: string | null;
  language?: string;
  accessToken?: string | null;
  includeExternal?: boolean;
}) {
  const params = new URLSearchParams({ q: query });
  if (providers.length > 0) params.set('providers', providers.join(','));
  if (groupId) params.set('groupId', groupId);
  if (language) params.set('lang', language);
  if (includeExternal) params.set('includeExternal', 'true');

  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return readJson<DatasetSearchResult[]>(
    await fetch(`/api/datasets/search?${params.toString()}`, { headers })
  );
}

export async function searchDatasetCatalog({
  query,
  providers,
  groupId,
  language,
  accessToken,
}: {
  query: string;
  providers: readonly DatasetProviderId[];
  groupId?: string | null;
  language?: string;
  accessToken?: string | null;
}) {
  const params = new URLSearchParams({ q: query, withStatus: 'true' });
  if (providers.length > 0) params.set('providers', providers.join(','));
  if (groupId) params.set('groupId', groupId);
  if (language) params.set('lang', language);
  if (groupId) params.set('includeExternal', 'true');
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return readJson<DatasetProviderSearchResponse>(
    await fetch(`/api/datasets/search?${params.toString()}`, { headers })
  );
}

export async function createProviderSnapshot(
  request:
    | { provider: 'EUROSTAT'; code: string; language: 'en' | 'de' | 'fr' }
    | { provider: 'GOVDATA'; packageId: string; resourceId: string }
    | { provider: 'GENESIS_DESTATIS'; code: string; language: 'en' | 'de' },
  accessToken?: string | null
) {
  return readJson<DatasetSnapshotImportResult>(
    await fetch('/api/datasets/snapshots', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(request),
    })
  );
}

export async function createDataViewProjection(
  request: DataViewProjectionRequest,
  accessToken?: string | null
) {
  const { snapshotId, ...body } = request;
  return readJson<DataViewProjection>(
    await fetch(`/api/datasets/${encodeURIComponent(snapshotId)}/projection`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    })
  );
}

export async function loadDatasetColumnValues(
  snapshotId: string,
  column: string,
  query = '',
  accessToken?: string | null
) {
  const params = new URLSearchParams({ column, q: query, limit: '50' });
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return readJson<string[]>(
    await fetch(`/api/datasets/${encodeURIComponent(snapshotId)}/values?${params}`, { headers })
  );
}

export async function loadDatasetDetails(datasetId: string, accessToken?: string | null) {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return readJson<DatasetSearchResult & { snapshots: unknown[] }>(
    await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/details`, { headers })
  );
}

export async function uploadDataset(
  request: {
    file: File;
    groupId: string;
    title?: string;
    description?: string;
  },
  accessToken?: string | null
) {
  const formData = new FormData();
  formData.set('file', request.file);
  formData.set('groupId', request.groupId);
  if (request.title) formData.set('title', request.title);
  if (request.description) formData.set('description', request.description);

  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return readJson<DatasetSnapshotImportResult>(
    await fetch('/api/datasets/upload', {
      method: 'POST',
      headers,
      body: formData,
    })
  );
}

export async function archiveDataset(datasetId: string, accessToken?: string | null) {
  return readJson<{ ok: true }>(
    await fetch('/api/datasets/archive', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ datasetId }),
    })
  );
}
