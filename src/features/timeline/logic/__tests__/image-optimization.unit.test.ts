import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  calculateAspectRatio,
  generateBlurPlaceholder,
  generateSizes,
  generateSrcSet,
  getAspectRatioClass,
  getImageDimensions,
  getImageFormat,
  getImageSizeForCard,
  isImageUrl,
  optimizeImage,
  shouldLazyLoad,
} from '../image-optimization';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('timeline image optimization', () => {
  it('keeps the original source while accepting explicit and default src-set arguments', () => {
    expect(generateSrcSet('/image.jpg', [320])).toBe('/image.jpg');
    expect(generateSrcSet('/image.jpg', [320], 50)).toBe('/image.jpg');
  });

  it('builds default and custom responsive size declarations', () => {
    expect(generateSizes()).toBe('(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw');
    expect(generateSizes({ print: '10cm', default: '25vw' })).toBe('print 10cm, 25vw');
  });

  it('calculates ratios and maps every ratio boundary', () => {
    expect(calculateAspectRatio(16, 9)).toBe(16 / 9);
    expect([1.7, 1.4, 1.2, 0.9, 0.7, 0.69].map(getAspectRatioClass)).toEqual([
      'aspect-video',
      'aspect-[3/2]',
      'aspect-[4/3]',
      'aspect-square',
      'aspect-[3/4]',
      'aspect-[9/16]',
    ]);
  });

  it('uses the visible-count boundary for lazy loading', () => {
    expect(shouldLazyLoad(5)).toBe(false);
    expect(shouldLazyLoad(6)).toBe(true);
    expect(shouldLazyLoad(2, 2)).toBe(true);
  });

  it('generates SVG placeholders with default and custom colors', () => {
    const defaultSvg = Buffer.from(generateBlurPlaceholder().split(',')[1], 'base64').toString();
    const customSvg = Buffer.from(
      generateBlurPlaceholder('#123456').split(',')[1],
      'base64'
    ).toString();
    expect(defaultSvg).toContain('<svg');
    expect(customSvg).toContain('fill="#123456"');
  });

  it('returns null for dimensions during server rendering', async () => {
    vi.stubGlobal('window', undefined);
    await expect(getImageDimensions('/image.jpg')).resolves.toBeNull();
  });

  it('resolves browser image dimensions and load failures', async () => {
    class FakeImage {
      naturalWidth = 800;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        queueMicrotask(() => (value === 'ok' ? this.onload?.() : this.onerror?.()));
      }
    }
    vi.stubGlobal('window', {});
    vi.stubGlobal('Image', FakeImage);
    await expect(getImageDimensions('ok')).resolves.toEqual({
      width: 800,
      height: 400,
      aspectRatio: 2,
    });
    await expect(getImageDimensions('error')).resolves.toBeNull();
  });

  it('optimizes with defaults and explicit placeholder suppression', () => {
    const defaults = optimizeImage('/image.jpg');
    expect(defaults).toMatchObject({ src: '/image.jpg', srcSet: '/image.jpg' });
    expect(defaults.placeholder).toMatch(/^data:image\/svg\+xml;base64,/);

    expect(
      optimizeImage('/image.jpg', { widths: [100], quality: 20, withPlaceholder: false })
    ).toEqual({
      src: '/image.jpg',
      srcSet: '/image.jpg',
      sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
      placeholder: undefined,
    });
  });

  it('returns card presets and detects image URLs and formats case-insensitively', () => {
    expect(getImageSizeForCard('thumbnail')).toEqual({ width: 150, height: 150 });
    expect(getImageSizeForCard('full')).toEqual({ width: 1920, height: 1080 });
    expect(isImageUrl('https://example.test/photo.JPG?size=1')).toBe(true);
    expect(isImageUrl('https://example.test/document.pdf')).toBe(false);
    expect(getImageFormat('/photo.JPEG?size=1')).toBe('jpeg');
    expect(getImageFormat('/document.pdf')).toBeNull();
  });
});
