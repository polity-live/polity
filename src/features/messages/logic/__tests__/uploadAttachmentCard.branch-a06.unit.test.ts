import { describe, expect, it } from 'vitest';

import {
  buildUploadAttachment,
  buildUploadAttachmentCardPayload,
  buildUploadAttachmentDownloadUrl,
  formatUploadFileSize,
  isImageUploadMimeType,
  isUploadAttachmentCardPayload,
} from '../uploadAttachmentCard';

const file = {
  key: 'file-1',
  url: 'https://example.test/file',
  name: 'File.png',
  size: 1536,
  type: 'IMAGE/PNG',
};

describe('uploadAttachmentCard exhaustive branches', () => {
  it('classifies MIME values and formats every size range', () => {
    expect(isImageUploadMimeType(null)).toBe(false);
    expect(isImageUploadMimeType(undefined)).toBe(false);
    expect(isImageUploadMimeType('text/plain')).toBe(false);
    expect(isImageUploadMimeType('IMAGE/PNG')).toBe(true);

    expect(formatUploadFileSize(Number.NaN)).toBe('0 B');
    expect(formatUploadFileSize(-1)).toBe('0 B');
    expect(formatUploadFileSize(1)).toBe('1 B');
    expect(formatUploadFileSize(1024)).toBe('1.0 KB');
    expect(formatUploadFileSize(12 * 1024)).toBe('12 KB');
    expect(formatUploadFileSize(1024 ** 2)).toBe('1.0 MB');
    expect(formatUploadFileSize(1024 ** 4)).toBe('1024 GB');
  });

  it('builds image and generic upload cards, subtitles, contexts and download URLs', () => {
    expect(buildUploadAttachmentCardPayload(file)).toMatchObject({ previewType: 'image' });
    expect(buildUploadAttachment(file)).toMatchObject({
      subtitle: 'Image · 1.5 KB',
      prompt_context: expect.stringContaining('MIME type: IMAGE/PNG'),
    });

    const typed = buildUploadAttachment({ ...file, type: 'application/pdf', name: 'Doc.pdf' });
    expect(typed.subtitle).toBe('application/pdf · 1.5 KB');
    expect(JSON.parse(typed.card_data_json ?? '')).toMatchObject({ previewType: 'file' });

    const untyped = buildUploadAttachment({ ...file, type: '   ', size: 0 });
    expect(untyped.subtitle).toBe('File · 0 B');
    expect(untyped.prompt_context).not.toContain('MIME type');

    expect(buildUploadAttachmentDownloadUrl('/file#preview', 'A B')).toBe(
      '/file?download=A%20B#preview'
    );
    expect(buildUploadAttachmentDownloadUrl('/file?token=x', 'A')).toBe('/file?token=x&download=A');
  });

  it('validates each upload-card field and both preview types', () => {
    const valid = buildUploadAttachmentCardPayload(file);
    expect(isUploadAttachmentCardPayload(valid)).toBe(true);
    expect(isUploadAttachmentCardPayload({ ...valid, previewType: 'file' })).toBe(true);
    expect(isUploadAttachmentCardPayload(null)).toBe(false);
    expect(isUploadAttachmentCardPayload('upload')).toBe(false);

    for (const invalid of [
      { ...valid, kind: 'other' },
      { ...valid, fileUrl: 1 },
      { ...valid, fileName: 1 },
      { ...valid, fileType: 1 },
      { ...valid, fileSize: '1' },
      { ...valid, previewType: 'video' },
    ]) {
      expect(isUploadAttachmentCardPayload(invalid)).toBe(false);
    }
  });
});
