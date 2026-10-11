import { describe, expect, it } from 'vitest';
import {
  DatasetProviderFailure,
  datasetProviderErrorResponse,
  providerFailureCode,
  providerResponseFailure,
} from '../providerError';

describe('dataset provider failure boundaries', () => {
  it.each(['AbortError', 'TimeoutError'])(
    'preserves %s cancellation and exposes the structured timeout response',
    async name => {
      const failure = new DOMException('private upstream details', name);
      expect(providerResponseFailure(failure, 'GENESIS')).toBe(failure);
      expect(providerFailureCode(failure)).toBe('timeout');
      const response = datasetProviderErrorResponse(failure)!;
      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({
        error: { version: 1, code: 'dataset_provider_timeout' },
      });
    }
  );

  it.each([
    ['authentication', 503, 'dataset_provider_authentication'],
    ['timeout', 504, 'dataset_provider_timeout'],
    ['invalid_response', 502, 'dataset_provider_invalid_response'],
    ['invalid_scope', 422, 'dataset_scope_unavailable'],
    ['too_large', 413, 'dataset_scope_too_large'],
    ['unavailable', 502, 'dataset_provider_unavailable'],
  ] as const)(
    'retains %s classification without leaking upstream details',
    async (code, status, appCode) => {
      const failure = new DatasetProviderFailure('private upstream details', code, status, 500);
      expect(providerResponseFailure(failure, 'GENESIS')).toBe(failure);
      expect(providerFailureCode(failure)).toBe(
        code === 'invalid_scope' || code === 'too_large' ? 'unavailable' : code
      );
      const response = datasetProviderErrorResponse(failure)!;
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { version: 1, code: appCode } });
    }
  );

  it.each([
    new Error('Response exceeds 50 MiB'),
    new Error('TOO_MANY_ROWS'),
    Object.assign(new Error('buffer allocation failed'), { code: 'ERR_BUFFER_TOO_LARGE' }),
  ])('classifies response size failures as a smaller selection requirement', async failure => {
    expect(providerResponseFailure(failure, 'GENESIS')).toMatchObject({
      message: 'GENESIS requires a smaller import selection',
      code: 'too_large',
      httpStatus: 413,
    });
    const response = datasetProviderErrorResponse(failure)!;
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { version: 1, code: 'dataset_scope_too_large' },
    });
  });

  it.each([new Error('database failed'), 'provider disconnected', null])(
    'leaves unrelated server failures to their owning boundary',
    failure => {
      expect(datasetProviderErrorResponse(failure)).toBeNull();
      expect(providerFailureCode(failure)).toBe('unavailable');
      expect(providerResponseFailure(failure, 'Eurostat')).toMatchObject({
        message: 'Eurostat returned an unreadable response',
        code: 'invalid_response',
        httpStatus: 502,
      });
    }
  );
});
