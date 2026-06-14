import type {
  EurostatCatalogueEntry,
  EurostatDatasetDetails,
  EurostatImportProgress,
  EurostatProjectionRequest,
  EurostatProjectionResult,
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

export async function searchEurostatDatasets(query: string, language: string) {
  const params = new URLSearchParams({ q: query, lang: language });
  return readJson<EurostatCatalogueEntry[]>(
    await fetch(`/api/eurostat/catalogue?${params.toString()}`)
  );
}

export async function loadEurostatDatasetDetails(code: string, language: string) {
  const params = new URLSearchParams({ code, lang: language });
  return readJson<EurostatDatasetDetails>(
    await fetch(`/api/eurostat/details?${params.toString()}`)
  );
}

export async function startEurostatImport(
  code: string,
  language: string,
  accessToken?: string | null
) {
  return readJson<EurostatImportProgress>(
    await fetch('/api/eurostat/import', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ code, language }),
    })
  );
}

export async function continueEurostatImport(datasetId: string, accessToken?: string | null) {
  return readJson<EurostatImportProgress>(
    await fetch('/api/eurostat/import-step', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ datasetId }),
    })
  );
}

export async function createEurostatChartProjection(
  request: EurostatProjectionRequest,
  accessToken?: string | null
) {
  return readJson<EurostatProjectionResult>(
    await fetch('/api/eurostat/projection', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(request),
    })
  );
}
