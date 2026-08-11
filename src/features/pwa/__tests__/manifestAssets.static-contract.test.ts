import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

interface WebAppManifestImage {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
  form_factor?: string;
  label?: string;
}

interface WebAppManifest {
  lang: 'en' | 'de';
  name: string;
  description: string;
  icons: WebAppManifestImage[];
  screenshots: WebAppManifestImage[];
}

const repoRoot = process.cwd();
const publicDir = join(repoRoot, 'public');
const manifests = (['en', 'de'] as const).map(
  language =>
    JSON.parse(readFileSync(join(publicDir, `manifest.${language}.json`), 'utf8')) as WebAppManifest
);

function publicPath(src: string) {
  return join(publicDir, src.replace(/^\//, ''));
}

function readPngDimensions(src: string) {
  const bytes = readFileSync(publicPath(src));
  const pngSignature = '89504e470d0a1a0a';

  expect(bytes.subarray(0, 8).toString('hex')).toBe(pngSignature);

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function parseDeclaredSize(size: string) {
  const [width, height] = size.split('x').map(Number);

  return { width, height };
}

describe('PWA manifest assets', () => {
  it('declares installable PNG icons with a valid any-purpose icon', () => {
    const manifest = manifests[0];
    const anyPurposeIcons = manifest.icons.filter(icon => icon.purpose === 'any' || !icon.purpose);

    expect(anyPurposeIcons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');

      const declared = parseDeclaredSize(icon.sizes);
      const actual = readPngDimensions(icon.src);

      expect(actual).toEqual(declared);
    }

    expect(
      anyPurposeIcons.some(icon => {
        const { width, height } = readPngDimensions(icon.src);

        return width >= 144 && height >= 144;
      })
    ).toBe(true);
  });

  it('declares rich install UI screenshots for desktop and mobile', () => {
    const manifest = manifests[0];
    expect(manifest.screenshots.some(screenshot => screenshot.form_factor === 'wide')).toBe(true);
    expect(manifest.screenshots.some(screenshot => screenshot.form_factor !== 'wide')).toBe(true);

    for (const screenshot of manifest.screenshots) {
      expect(screenshot.type).toBe('image/png');
      expect(screenshot.label).toBeTruthy();

      const declared = parseDeclaredSize(screenshot.sizes);
      const actual = readPngDimensions(screenshot.src);

      expect(actual).toEqual(declared);
    }
  });

  it('provides complete English and German metadata', () => {
    expect(manifests.map(manifest => manifest.lang)).toEqual(['en', 'de']);
    expect(manifests[0].name).not.toBe(manifests[1].name);
    expect(manifests[0].description).not.toBe(manifests[1].description);

    for (const manifest of manifests) {
      expect(manifest.name).toBeTruthy();
      expect(manifest.description).toBeTruthy();
      expect(manifest.screenshots.every(screenshot => Boolean(screenshot.label))).toBe(true);
    }
  });
});
