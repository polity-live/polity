import type { DatasetProviderError } from '@/features/charts/types';
import { appErrorHttpBody } from '@/features/shared/errors/app-error';

export class DatasetProviderFailure extends Error {
  constructor(
    message: string,
    readonly code: NonNullable<DatasetProviderError['code']> | 'invalid_scope' | 'too_large',
    readonly httpStatus = 502,
    readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = 'DatasetProviderFailure';
  }
}

/** Classify failures only at the provider's download/decoding boundary, never database failures. */
export function providerResponseFailure(error: unknown, provider: string): Error {
  if (error instanceof DatasetProviderFailure) return error;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return error;
  if (
    error instanceof Error &&
    (/50 MiB|TOO_MANY_ROWS/.test(error.message) ||
      (error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE')
  )
    return new DatasetProviderFailure(
      `${provider} requires a smaller import selection`,
      'too_large',
      413
    );
  return new DatasetProviderFailure(
    `${provider} returned an unreadable response`,
    'invalid_response'
  );
}

export function datasetProviderErrorResponse(error: unknown): Response | null {
  if (error instanceof DatasetProviderFailure) {
    const code =
      error.code === 'authentication'
        ? 'dataset_provider_authentication'
        : error.code === 'timeout'
          ? 'dataset_provider_timeout'
          : error.code === 'invalid_response'
            ? 'dataset_provider_invalid_response'
            : error.code === 'invalid_scope'
              ? 'dataset_scope_unavailable'
              : error.code === 'too_large'
                ? 'dataset_scope_too_large'
                : 'dataset_provider_unavailable';
    return Response.json(appErrorHttpBody(code), { status: error.httpStatus });
  }
  if (
    error instanceof Error &&
    (/50 MiB|TOO_MANY_ROWS/.test(error.message) ||
      (error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE')
  )
    return Response.json(appErrorHttpBody('dataset_scope_too_large'), { status: 413 });
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
    return Response.json(appErrorHttpBody('dataset_provider_timeout'), { status: 504 });
  return null;
}

export function providerFailureCode(error: unknown): DatasetProviderError['code'] {
  if (
    error instanceof DatasetProviderFailure &&
    error.code !== 'invalid_scope' &&
    error.code !== 'too_large'
  )
    return error.code;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
    return 'timeout';
  return 'unavailable';
}
