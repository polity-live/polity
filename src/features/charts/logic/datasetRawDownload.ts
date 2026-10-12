import { parseAppError } from '@/features/shared/errors/app-error';
import type {
  DatasetRawDownloadRequest,
  DatasetSearchResult,
  DatasetPreviewRequest,
} from '../types';

export interface DatasetRawDownloadTarget {
  request?: DatasetRawDownloadRequest;
  file?: File;
  sourceUrl?: string | null;
}
export function canRecoverDatasetFile(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') return false;
  const code = parseAppError(error)?.code;
  return (
    !code ||
    [
      'unknown',
      'dataset_operation_failed',
      'dataset_provider_timeout',
      'dataset_provider_unavailable',
      'dataset_provider_invalid_response',
      'dataset_scope_too_large',
      'upload_failed',
      'file_too_large',
      'dataset_observations_ambiguous',
      'dataset_non_additive',
    ].includes(code)
  );
}
export function datasetRawDownloadTarget(
  result?: DatasetSearchResult | null,
  request?: DatasetPreviewRequest | null,
  language: 'de' | 'en' | 'fr' = 'en'
): DatasetRawDownloadTarget | undefined {
  const provider = request?.provider ?? result?.provider;
  if (!provider) return;
  const snapshotId = request?.snapshotId ?? result?.snapshotId;
  const providerDatasetId = request?.providerDatasetId ?? result?.providerDatasetId;
  if (provider === 'UPLOAD' ? !snapshotId : !providerDatasetId) return;
  const providerResourceId = request?.providerResourceId ?? result?.providerResourceId;
  if (provider === 'GOVDATA' && !providerResourceId) return;
  return {
    request: {
      provider,
      providerDatasetId,
      providerResourceId,
      ...(snapshotId ? { snapshotId, datasetId: request?.datasetId ?? result?.id } : {}),
      language:
        request?.language === 'de' || request?.language === 'en' || request?.language === 'fr'
          ? request.language
          : language,
    },
    sourceUrl: result?.sourceUrl,
  };
}
