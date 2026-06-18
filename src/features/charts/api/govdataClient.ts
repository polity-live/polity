import type { GovDataCatalogueEntry, GovDataImportResult } from '../types';

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

export async function searchGovDataDatasets(query: string) {
  const params = new URLSearchParams({ q: query });
  return readJson<GovDataCatalogueEntry[]>(
    await fetch(`/api/govdata/catalogue?${params.toString()}`)
  );
}

export async function importGovDataCsvResource(
  request: { packageId: string; resourceId: string },
  accessToken?: string | null
) {
  return readJson<GovDataImportResult>(
    await fetch('/api/govdata/import', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(request),
    })
  );
}
