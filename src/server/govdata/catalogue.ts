import type { GovDataCatalogueEntry, GovDataResourceSummary } from '@/features/charts/types';

export const GOVDATA_ACTION_BASE_URL = 'https://www.govdata.de/ckan/api/3/action';

interface CkanActionResponse<T> {
  success: boolean;
  result?: T;
  error?: { message?: string };
}

interface CkanOrganization {
  title?: string | null;
  name?: string | null;
}

interface CkanExtra {
  key?: string | null;
  value?: string | null;
}

interface CkanResource {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  format?: string | null;
  mimetype?: string | null;
  size?: number | string | null;
  modified?: string | null;
  last_modified?: string | null;
  metadata_modified?: string | null;
  hash?: string | null;
  url?: string | null;
  download_url?: string | null;
  access_url?: string | null;
}

export interface CkanPackage {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  notes?: string | null;
  maintainer?: string | null;
  license_title?: string | null;
  metadata_modified?: string | null;
  modified?: string | null;
  organization?: CkanOrganization | null;
  extras?: CkanExtra[] | null;
  resources?: CkanResource[] | null;
}

interface PackageSearchResult {
  results: CkanPackage[];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function lastUriSegment(value: string) {
  const trimmed = value.trim();
  const withoutHash = trimmed.split('#').pop() ?? trimmed;
  const withoutSlash = withoutHash.split('/').pop() ?? withoutHash;
  return withoutSlash.trim();
}

export function normalizeGovDataFormat(format?: string | null, mimetype?: string | null) {
  const formatValue = lastUriSegment(text(format)).toUpperCase();
  if (formatValue) return formatValue;
  return text(mimetype).toLowerCase().includes('csv') ? 'CSV' : '';
}

function resourceUrl(resource: CkanResource) {
  return text(resource.download_url) || text(resource.url) || text(resource.access_url);
}

export function isGovDataCsvResource(resource: CkanResource) {
  const normalizedFormat = normalizeGovDataFormat(resource.format, resource.mimetype);
  const url = resourceUrl(resource).toLowerCase();

  return (
    normalizedFormat === 'CSV' ||
    text(resource.mimetype).toLowerCase().includes('csv') ||
    /\.csv(?:[?#].*)?$/.test(url)
  );
}

function normalizeResource(resource: CkanResource): GovDataResourceSummary | null {
  const id = text(resource.id);
  const url = resourceUrl(resource);
  if (!id || !url || !isGovDataCsvResource(resource)) return null;

  const sizeValue = Number(resource.size);
  return {
    id,
    name: text(resource.name) || text(resource.description) || 'CSV resource',
    format: normalizeGovDataFormat(resource.format, resource.mimetype) || 'CSV',
    mimetype: nullableText(resource.mimetype),
    size: Number.isFinite(sizeValue) ? sizeValue : null,
    modified: nullableText(
      resource.modified ?? resource.last_modified ?? resource.metadata_modified
    ),
    url,
  };
}

function extraValue(pkg: CkanPackage, key: string) {
  return pkg.extras?.find(extra => extra.key === key)?.value ?? null;
}

export function normalizeGovDataPackage(pkg: CkanPackage): GovDataCatalogueEntry | null {
  const id = text(pkg.id);
  const name = text(pkg.name);
  const resources = (pkg.resources ?? [])
    .map(normalizeResource)
    .filter((resource): resource is GovDataResourceSummary => Boolean(resource));

  if (!id || !name || resources.length === 0) return null;

  const organizationTitle = nullableText(pkg.organization?.title ?? pkg.organization?.name);
  return {
    id,
    name,
    title: text(pkg.title) || name,
    notes: nullableText(pkg.notes),
    publisher: nullableText(extraValue(pkg, 'publisher_name') ?? pkg.maintainer),
    organizationTitle,
    modified: nullableText(pkg.modified ?? pkg.metadata_modified),
    resources,
  };
}

async function callGovDataAction<T>(action: string, params: Record<string, string | number>) {
  const url = new URL(`${GOVDATA_ACTION_BASE_URL}/${action}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GovData ${action} request failed with ${response.status}`);
  }

  const body = (await response.json()) as CkanActionResponse<T>;
  if (!body.success || body.result == null) {
    throw new Error(body.error?.message || `GovData ${action} request failed`);
  }
  return body.result;
}

export async function searchGovDataCatalogue(query: string, limit = 20) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const result = await callGovDataAction<PackageSearchResult>('package_search', {
    q: normalizedQuery,
    rows: 50,
  });

  return result.results
    .map(normalizeGovDataPackage)
    .filter((entry): entry is GovDataCatalogueEntry => Boolean(entry))
    .slice(0, limit);
}

export async function loadGovDataPackage(packageId: string) {
  return callGovDataAction<CkanPackage>('package_show', { id: packageId });
}
