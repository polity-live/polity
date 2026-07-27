import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  APP_ERROR_PREFIX,
  AppError,
  appErrorHttpBody,
  encodeAppError,
  localizeAppError,
  parseAppError,
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
});
