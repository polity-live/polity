/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaUploadToastController } from '../useMediaUploadToastController';

const mocks = vi.hoisted(() => ({
  uploadError: null as any,
  toastError: vi.fn(),
  t: vi.fn((key: string, params?: unknown) => `${key}:${JSON.stringify(params)}`),
}));

vi.mock('@platejs/media/react', () => ({
  PlaceholderPlugin: {},
  UploadErrorCode: {
    INVALID_FILE_SIZE: 'invalid-size',
    INVALID_FILE_TYPE: 'invalid-type',
    TOO_LARGE: 'too-large',
    TOO_LESS_FILES: 'too-few',
    TOO_MANY_FILES: 'too-many',
  },
}));

vi.mock('platejs/react', () => ({
  usePluginOption: () => mocks.uploadError,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError },
}));

beforeEach(() => {
  mocks.uploadError = null;
  mocks.toastError.mockClear();
  mocks.t.mockClear();
});

describe('useMediaUploadToastController', () => {
  it('stays silent without an upload error', () => {
    renderHook(() => useMediaUploadToastController());
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it.each([
    [
      'invalid-size',
      { files: [{ name: 'large.png' }, { name: 'huge.jpg' }] },
      'mediaUpload.errors.invalidFileSize',
      'large.png, huge.jpg',
    ],
    [
      'invalid-type',
      { files: [{ name: 'script.exe' }] },
      'mediaUpload.errors.invalidFileType',
      'script.exe',
    ],
    [
      'too-large',
      { files: [{ name: 'movie.mp4' }], maxFileSize: 1000 },
      'mediaUpload.errors.tooLarge',
      '1000',
    ],
    ['too-few', { minFileCount: 2, fileType: 'image' }, 'mediaUpload.errors.tooLessFiles', 'image'],
  ] as const)('reports %s upload errors', (code, data, key, expectedDetail) => {
    mocks.uploadError = { code, data };
    renderHook(() => useMediaUploadToastController());

    expect(mocks.t).toHaveBeenCalledWith(key, expect.any(Object));
    expect(mocks.toastError.mock.calls[0][0]).toContain(expectedDetail);
  });

  it.each([
    ['image', ' for image'],
    [null, '"forFileType":""'],
  ] as const)('formats too-many-files with file type %s', (fileType, expected) => {
    mocks.uploadError = {
      code: 'too-many',
      data: { maxFileCount: 3, fileType },
    };
    renderHook(() => useMediaUploadToastController());
    expect(mocks.toastError.mock.calls[0][0]).toContain(expected);
  });

  it('ignores unknown defensive error codes', () => {
    mocks.uploadError = { code: 'unknown', data: {} };
    renderHook(() => useMediaUploadToastController());
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
