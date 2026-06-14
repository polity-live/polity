import { parse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import {
  MAX_EUROSTAT_DATASET_BYTES,
  type EurostatDatasetDetails,
  type EurostatDimension,
} from '@/features/charts/types';
import { DETAILS_CACHE_MS, EUROSTAT_BASE_URL } from './constants';
import { findEurostatCatalogueEntry } from './catalogue';
import { createStableHash } from './hash';
import { readEurostatCsvResponse } from './response';

interface DetailsCacheEntry {
  expiresAt: number;
  details: EurostatDatasetDetails;
}

const cache = new Map<string, DetailsCacheEntry>();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function localizedName(value: unknown, language: string) {
  const names = asArray<any>(value);
  const preferred =
    names.find(name => name?.['@_lang'] === language) ??
    names.find(name => name?.['@_lang'] === 'en') ??
    names[0];
  if (typeof preferred === 'string') return preferred;
  return String(preferred?.['#text'] ?? '').trim() || null;
}

function getCodelists(structure: Record<string, any>, language: string) {
  const codelists = asArray<Record<string, any>>(
    structure?.Structure?.Structures?.Codelists?.Codelist
  );

  return new Map(
    codelists.map(codelist => {
      const values = new Map(
        asArray<Record<string, any>>(codelist.Code).map(code => [
          String(code['@_id']),
          localizedName(code.Name, language),
        ])
      );
      return [
        String(codelist['@_id']),
        {
          label: localizedName(codelist.Name, language),
          values,
        },
      ];
    })
  );
}

function getDimensionDefinitions(structure: Record<string, any>) {
  const dimensionList =
    structure?.Structure?.Structures?.DataStructures?.DataStructure?.DataStructureComponents
      ?.DimensionList;
  const dimensions = [
    ...asArray<Record<string, any>>(dimensionList?.Dimension),
    ...asArray<Record<string, any>>(dimensionList?.TimeDimension),
  ];

  return new Map(
    dimensions.map(dimension => [
      String(dimension['@_id']),
      {
        position: Number(dimension['@_position'] ?? 0),
        codelistId: dimension?.LocalRepresentation?.Enumeration?.Ref?.['@_id'] ?? null,
        codelistVersion: dimension?.LocalRepresentation?.Enumeration?.Ref?.['@_version'] ?? null,
      },
    ])
  );
}

function getConstraintDimensions(
  constraint: Record<string, any>,
  definitions: ReturnType<typeof getDimensionDefinitions>,
  codelists: ReturnType<typeof getCodelists>
): EurostatDimension[] {
  const keyValues = asArray<Record<string, any>>(
    constraint?.Structure?.Structures?.Constraints?.ContentConstraint?.CubeRegion?.KeyValue
  );

  return keyValues
    .map((keyValue, index) => {
      const id = String(keyValue['@_id'] ?? '');
      const definition = definitions.get(id);
      const codelist = definition?.codelistId ? codelists.get(definition.codelistId) : undefined;
      return {
        id,
        label: codelist?.label ?? id.replaceAll('_', ' '),
        position: definition?.position ?? index + 1,
        codelistId: definition?.codelistId ?? null,
        codelistVersion: definition?.codelistVersion ?? null,
        values: asArray<string | number>(keyValue.Value).map(value => ({
          id: String(value),
          label: codelist?.values.get(String(value)) ?? undefined,
        })),
      };
    })
    .filter(dimension => dimension.id && dimension.values.length > 0)
    .sort((left, right) => left.position - right.position);
}

function buildDataUrl(
  code: string,
  filters: Record<string, readonly string[]>,
  attributes: 'all' | 'none' = 'all'
) {
  const url = new URL(
    `${EUROSTAT_BASE_URL}/sdmx/3.0/data/dataflow/ESTAT/${encodeURIComponent(code)}/1.0`
  );
  for (const [dimension, values] of Object.entries(filters)) {
    url.searchParams.set(`c[${dimension}]`, values.join(','));
  }
  url.searchParams.set('attributes', attributes);
  url.searchParams.set('measures', 'all');
  return url;
}

async function sampleDataset(code: string, dimensions: readonly EurostatDimension[]) {
  const filters = Object.fromEntries(
    dimensions.map(dimension => [
      dimension.id,
      [
        (dimension.id === 'TIME_PERIOD' ? dimension.values.at(-1)?.id : dimension.values[0]?.id) ??
          '',
      ],
    ])
  );
  const response = await fetch(buildDataUrl(code, filters), {
    headers: {
      Accept: 'application/vnd.sdmx.data+csv;version=2.0.0;labels=id',
    },
  });
  if (!response.ok) {
    return { attributes: [] as string[], sampleRowBytes: 256 };
  }

  const text = await readEurostatCsvResponse(response);
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    to_line: 2,
  }) as Record<string, string>[];
  const row = records[0];
  if (!row) {
    return { attributes: [] as string[], sampleRowBytes: 256 };
  }

  const dimensionIds = new Set(dimensions.map(dimension => dimension.id));
  const ignored = new Set(['STRUCTURE', 'STRUCTURE_ID', 'DATAFLOW', 'LAST UPDATE', 'OBS_VALUE']);
  const attributes = Object.keys(row).filter(key => !dimensionIds.has(key) && !ignored.has(key));
  return {
    attributes,
    sampleRowBytes: Math.max(64, new TextEncoder().encode(JSON.stringify(row)).byteLength),
  };
}

export function estimateEurostatDatasetBytes(valueCount: number, sampleRowBytes: number) {
  return Math.ceil(valueCount * (sampleRowBytes + 128) * 1.2);
}

export async function getEurostatDatasetDetails(code: string, language = 'en') {
  const normalizedCode = code.trim().toUpperCase();
  const cacheKey = `${normalizedCode}:${language}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.details;
  }

  const catalogueEntry = await findEurostatCatalogueEntry(normalizedCode, language);
  const [structureResponse, constraintResponse] = await Promise.all([
    fetch(
      `${EUROSTAT_BASE_URL}/sdmx/2.1/datastructure/ESTAT/${encodeURIComponent(normalizedCode)}/latest?references=children`
    ),
    fetch(
      `${EUROSTAT_BASE_URL}/sdmx/2.1/contentconstraint/ESTAT/${encodeURIComponent(normalizedCode)}/latest`
    ),
  ]);
  if (!structureResponse.ok || !constraintResponse.ok) {
    throw new Error(`Eurostat metadata for ${normalizedCode} is unavailable`);
  }

  const [structure, constraint] = await Promise.all([
    structureResponse.text().then(text => parser.parse(text)),
    constraintResponse.text().then(text => parser.parse(text)),
  ]);
  const dimensions = getConstraintDimensions(
    constraint,
    getDimensionDefinitions(structure),
    getCodelists(structure, language)
  );
  const sample = await sampleDataset(normalizedCode, dimensions);
  const estimatedBytes = estimateEurostatDatasetBytes(
    catalogueEntry.valueCount,
    sample.sampleRowBytes
  );
  const snapshotKey = createStableHash({
    code: normalizedCode,
    lastUpdate: catalogueEntry.lastUpdate,
    structureLastChange: catalogueEntry.structureLastChange,
  });

  const details: EurostatDatasetDetails = {
    ...catalogueEntry,
    code: normalizedCode,
    language,
    snapshotKey,
    dimensions,
    attributes: sample.attributes,
    sampleRowBytes: sample.sampleRowBytes,
    estimatedBytes,
    importAllowed: estimatedBytes < MAX_EUROSTAT_DATASET_BYTES,
  };
  cache.set(cacheKey, {
    details,
    expiresAt: Date.now() + DETAILS_CACHE_MS,
  });
  return details;
}

export function createEurostatDataUrl(code: string, filters: Record<string, readonly string[]>) {
  return buildDataUrl(code, filters);
}
