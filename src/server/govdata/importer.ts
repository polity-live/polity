import { createHash } from 'node:crypto';
import { MAX_MANUAL_CSV_BYTES, type GovDataProvenance } from '@/features/charts/types';
import { isGovDataCsvResource, loadGovDataPackage, normalizeGovDataText } from './catalogue';
import { parseGovDataCsvTable } from './csv';
import { assertSafePublicHttpUrl } from './safety';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function extraValue(
  extras: readonly { key?: string | null; value?: string | null }[] | undefined,
  key: string
) {
  return extras?.find(extra => extra.key === key)?.value ?? null;
}

function createStableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function readLimitedResponseText(response: Response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_MANUAL_CSV_BYTES) {
    throw new Error('CSV_FILE_TOO_LARGE');
  }

  if (!response.body) {
    const textBody = await response.text();
    if (new TextEncoder().encode(textBody).byteLength > MAX_MANUAL_CSV_BYTES) {
      throw new Error('CSV_FILE_TOO_LARGE');
    }
    return textBody;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_MANUAL_CSV_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new Error('CSV_FILE_TOO_LARGE');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function createGovDataCsvSnapshot(
  packageId: string,
  resourceId: string
): Promise<{
  snapshotKey: string;
  columns: string[];
  rows: Record<string, string>[];
  provenance: GovDataProvenance;
}> {
  const pkg = await loadGovDataPackage(packageId);
  const resource = (pkg.resources ?? []).find(candidate => candidate.id === resourceId);
  if (!resource) {
    throw new Error('GovData resource was not found');
  }
  if (!isGovDataCsvResource(resource)) {
    throw new Error('GovData resource is not an importable CSV');
  }

  const resourceUrl =
    text(resource.download_url) || text(resource.url) || text(resource.access_url);
  const url = assertSafePublicHttpUrl(resourceUrl);
  const response = await fetch(url, {
    headers: { Accept: 'text/csv,application/csv,text/plain;q=0.9,*/*;q=0.1' },
  });
  if (!response.ok) {
    throw new Error(`GovData resource download failed with ${response.status}`);
  }

  const csvText = await readLimitedResponseText(response);
  const table = parseGovDataCsvTable(csvText);
  const organizationTitle = nullableText(
    normalizeGovDataText(pkg.organization?.title ?? pkg.organization?.name)
  );
  const resourceModified = nullableText(
    resource.modified ?? resource.last_modified ?? resource.metadata_modified
  );
  const contentHash = createHash('sha256').update(csvText).digest('hex');
  const snapshotKey = createStableHash({
    provider: 'govdata',
    packageId: pkg.id,
    resourceId,
    resourceUrl: url.toString(),
    contentHash,
    resourceHash: resource.hash,
    resourceModified,
  });

  const provenance: GovDataProvenance = {
    packageId: text(pkg.id),
    packageName: text(pkg.name),
    packageTitle: normalizeGovDataText(pkg.title) || text(pkg.name),
    resourceId,
    resourceName: normalizeGovDataText(resource.name) || 'CSV resource',
    resourceUrl: url.toString(),
    publisher: nullableText(
      normalizeGovDataText(extraValue(pkg.extras ?? undefined, 'publisher_name') ?? pkg.maintainer)
    ),
    organizationTitle,
    modified: nullableText(pkg.modified ?? pkg.metadata_modified),
    resourceModified,
    licenseTitle: nullableText(normalizeGovDataText(pkg.license_title)),
    importedAt: new Date().toISOString(),
  };

  return {
    snapshotKey,
    columns: table.columns,
    rows: table.rows,
    provenance,
  };
}
