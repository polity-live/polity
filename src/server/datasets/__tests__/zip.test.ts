import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { unzipFirstTextFile } from '../zip';

interface ZipEntry {
  name: string;
  text: string;
  method?: number;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concat(...chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function buildZip(entries: ZipEntry[]) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const method = entry.method ?? 0;
    const name = new TextEncoder().encode(entry.name);
    const plain = new TextEncoder().encode(entry.text);
    const compressed = method === 8 ? new Uint8Array(deflateRawSync(plain)) : plain;
    const local = new Uint8Array(30);
    local.set(uint32(0x04034b50), 0);
    local.set(uint16(method), 8);
    local.set(uint32(compressed.length), 18);
    local.set(uint32(plain.length), 22);
    local.set(uint16(name.length), 26);
    locals.push(local, name, compressed);

    const central = new Uint8Array(46);
    central.set(uint32(0x02014b50), 0);
    central.set(uint16(method), 10);
    central.set(uint32(compressed.length), 20);
    central.set(uint32(plain.length), 24);
    central.set(uint16(name.length), 28);
    central.set(uint32(localOffset), 42);
    centrals.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralBytes = concat(...centrals);
  const eocd = new Uint8Array(22);
  eocd.set(uint32(0x06054b50), 0);
  eocd.set(uint16(entries.length), 8);
  eocd.set(uint16(entries.length), 10);
  eocd.set(uint32(centralBytes.length), 12);
  eocd.set(uint32(localOffset), 16);
  return concat(...locals, centralBytes, eocd);
}

describe('unzipFirstTextFile', () => {
  it('returns plain input when no ZIP end signature exists', () => {
    expect(unzipFirstTextFile(new TextEncoder().encode('plain text'))).toBe('plain text');
  });

  it('decodes stored and deflated files', () => {
    expect(unzipFirstTextFile(buildZip([{ name: 'data.csv', text: 'a,b\n1,2' }]))).toBe('a,b\n1,2');
    expect(
      unzipFirstTextFile(buildZip([{ name: 'data.csv', text: 'compressed', method: 8 }]))
    ).toBe('compressed');
    expect(
      unzipFirstTextFile(
        concat(
          buildZip([{ name: 'data.csv', text: 'with trailing bytes' }]),
          Uint8Array.of(1, 2, 3)
        )
      )
    ).toBe('with trailing bytes');
  });

  it('skips directory and empty-name entries before the first file', () => {
    expect(
      unzipFirstTextFile(
        buildZip([
          { name: '', text: '' },
          { name: 'folder/', text: '' },
          { name: 'folder/data.csv', text: 'content' },
        ])
      )
    ).toBe('content');
  });

  it('rejects archives without a file entry', () => {
    expect(() => unzipFirstTextFile(buildZip([{ name: 'folder/', text: '' }]))).toThrow(
      'ZIP_HAS_NO_FILE_ENTRY'
    );
  });

  it('rejects missing central and local headers', () => {
    const missingCentral = buildZip([{ name: 'data.csv', text: 'content' }]);
    const eocdOffset = missingCentral.length - 22;
    const centralOffset = new DataView(missingCentral.buffer).getUint32(eocdOffset + 16, true);
    missingCentral[centralOffset] = 0;
    expect(() => unzipFirstTextFile(missingCentral)).toThrow('ZIP_CENTRAL_DIRECTORY_NOT_FOUND');

    const missingLocal = buildZip([{ name: 'data.csv', text: 'content' }]);
    missingLocal[0] = 0;
    expect(() => unzipFirstTextFile(missingLocal)).toThrow('ZIP_LOCAL_HEADER_NOT_FOUND');
  });

  it('rejects unsupported compression methods', () => {
    expect(() =>
      unzipFirstTextFile(buildZip([{ name: 'data.csv', text: 'content', method: 12 }]))
    ).toThrow('ZIP_UNSUPPORTED_COMPRESSION_12');
  });
});
