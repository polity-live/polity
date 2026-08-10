import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  APP_ERROR_PREFIX,
  AppError,
  appErrorHttpBody,
  appErrorHttpBodyFrom,
  encodeAppError,
  localizeAppError,
  parseAppError,
  throwAppError,
  toAppError,
} from '../app-error';

describe('application error payloads', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'en' });
    vi.restoreAllMocks();
  });

  it('encodes and decodes a versioned payload with safe parameters', () => {
    const encoded = encodeAppError('file_too_large', { maxSize: '10 MB' });

    expect(encoded.startsWith(APP_ERROR_PREFIX)).toBe(true);
    expect(parseAppError(encoded)).toEqual({
      version: 1,
      code: 'file_too_large',
      params: { maxSize: '10 MB' },
    });
    expect(parseAppError(new Error(encoded))).toEqual(parseAppError(encoded));
  });

  it('decodes AppError instances and HTTP response bodies', () => {
    const body = appErrorHttpBody('permission_denied');
    const error = new AppError(body.error);

    expect(parseAppError(error)).toEqual(body.error);
    expect(parseAppError(body)).toEqual(body.error);
  });

  it('interpolates localized output in English and German', () => {
    const encoded = encodeAppError('file_too_large', { maxSize: '10 MB' });

    expect(localizeAppError(encoded)).toBe('The file is too large. The maximum size is 10 MB.');
    useLanguageStore.setState({ language: 'de' });
    expect(localizeAppError(encoded)).toBe(
      'Die Datei ist zu groß. Die maximale Größe beträgt 10 MB.'
    );
  });

  it('uses the localized generic error for malformed and legacy messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(parseAppError(`${APP_ERROR_PREFIX}{broken`)).toBeNull();
    expect(localizeAppError(new Error('legacy database detail'))).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('validates every payload and parameter boundary', () => {
    const valid = {
      version: 1 as const,
      code: 'validation_failed' as const,
      params: { omitted: undefined, empty: null, text: 'value', count: 2 },
    };
    expect(parseAppError(valid)).toEqual(valid);

    for (const invalid of [
      null,
      1,
      [],
      {},
      { version: 0, code: 'unknown' },
      { version: 1, code: 1 },
      { version: 1, code: 'not-a-code' },
      { version: 1, code: 'unknown', params: null },
      { version: 1, code: 'unknown', params: 'bad' },
      { version: 1, code: 'unknown', params: [] },
      { version: 1, code: 'unknown', params: { invalid: true } },
      { error: { version: 0, code: 'unknown' } },
    ]) {
      expect(parseAppError(invalid)).toBeNull();
    }

    expect(parseAppError({ message: encodeAppError('already_exists') })).toEqual({
      version: 1,
      code: 'already_exists',
    });
    expect(parseAppError({ message: 42 })).toBeNull();
    expect(parseAppError({ other: 'value' })).toBeNull();
    expect(parseAppError(undefined)).toBeNull();
    expect(
      parseAppError(`${APP_ERROR_PREFIX}${JSON.stringify({ version: 1, code: 'bad' })}`)
    ).toBeNull();
  });

  it('omits empty params and throws structured errors with and without params', () => {
    expect(encodeAppError('unknown')).not.toContain('params');
    expect(encodeAppError('unknown', {})).not.toContain('params');
    expect(appErrorHttpBody('unknown')).toEqual({ error: { version: 1, code: 'unknown' } });
    expect(appErrorHttpBody('unknown', {})).toEqual({ error: { version: 1, code: 'unknown' } });
    expect(appErrorHttpBody('unknown', { count: 1 }).error.params).toEqual({ count: 1 });

    expect(() => throwAppError('action_blocked')).toThrow(AppError);
    expect(() => throwAppError('action_blocked', {})).toThrow(AppError);
    expect(() => throwAppError('action_blocked', { reason: 'closed' })).toThrow(
      encodeAppError('action_blocked', { reason: 'closed' })
    );
  });

  it('controls unknown logging and converts arbitrary values to error forms', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(localizeAppError('plain', { logUnknown: false })).toBe(
      'Something went wrong. Please try again.'
    );
    expect(localizeAppError(null)).toBe('Something went wrong. Please try again.');
    expect(error).not.toHaveBeenCalled();

    const parsed = toAppError(encodeAppError('already_exists'));
    expect(parsed.payload.code).toBe('already_exists');
    expect(toAppError('plain').payload.code).toBe('unknown');
    expect(toAppError('plain', 'external_service_failed').payload.code).toBe(
      'external_service_failed'
    );

    expect(appErrorHttpBodyFrom(parsed).error.code).toBe('already_exists');
    expect(appErrorHttpBodyFrom(null).error.code).toBe('unknown');
    expect(appErrorHttpBodyFrom('plain', 'mutation_server_failed').error.code).toBe(
      'mutation_server_failed'
    );
    expect(error).toHaveBeenCalledWith('Unstructured server error', 'plain');
  });
});
