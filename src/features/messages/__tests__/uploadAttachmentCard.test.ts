import { describe, expect, it } from 'vitest';
import { buildUploadAttachmentDownloadUrl } from '../logic/uploadAttachmentCard';

describe('buildUploadAttachmentDownloadUrl', () => {
  it('adds the storage download parameter for public upload urls', () => {
    expect(
      buildUploadAttachmentDownloadUrl(
        'http://127.0.0.1:54321/storage/v1/object/public/uploads/editor-uploads/file.png',
        'Carte 1 jour x 1.png'
      )
    ).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/uploads/editor-uploads/file.png?download=Carte%201%20jour%20x%201.png'
    );
  });

  it('preserves existing query params and hashes', () => {
    expect(
      buildUploadAttachmentDownloadUrl(
        'https://example.com/file.pdf?token=abc#preview',
        'Agenda.pdf'
      )
    ).toBe('https://example.com/file.pdf?token=abc&download=Agenda.pdf#preview');
  });
});
