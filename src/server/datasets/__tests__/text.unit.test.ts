import { describe, expect, it } from 'vitest';
import { decodeDatasetText } from '../text';
import { parseDatasetCsv, tableToCsv } from '../csv';

const csv = 'Veränderung;Stadt\n42;Düsseldorf\n-3;Köln';

describe('dataset byte decoding', () => {
  it('treats an empty content type as undeclared encoding', () => {
    expect(decodeDatasetText(new TextEncoder().encode(csv), ' ')).toBe(csv);
  });
  it.each([false, true])('preserves UTF-8 columns and cells with BOM=%s', bom => {
    const decoded = decodeDatasetText(new TextEncoder().encode((bom ? '\uFEFF' : '') + csv));
    expect(decoded).toBe(csv);
    expect(parseDatasetCsv(decoded)).toMatchObject({
      columns: ['Veränderung', 'Stadt'],
      rows: [
        { Veränderung: '42', Stadt: 'Düsseldorf' },
        { Veränderung: '-3', Stadt: 'Köln' },
      ],
    });
  });

  it('falls back to Windows-1252 before parsing and writes a UTF-8 roundtrip', () => {
    const decoded = decodeDatasetText(Buffer.from(csv, 'latin1'));
    const table = parseDatasetCsv(decoded);
    expect(decoded).toBe(csv);
    const stored = new TextEncoder().encode(tableToCsv(table));
    expect(parseDatasetCsv(new TextDecoder('utf-8', { fatal: true }).decode(stored))).toEqual(
      table
    );
    expect(decoded).not.toContain('\uFFFD');
  });

  it('decodes Windows-1252 punctuation as well as German letters', () => {
    expect(decodeDatasetText(Uint8Array.from([0x93, 0xe4, 0x94, 0x20, 0x80]))).toBe('“ä” €');
  });

  it.each(['text/csv; charset=ISO-8859-1', 'text/csv; CHARSET="windows-1252"', 'windows-1252'])(
    'honors the declared charset %s',
    contentType => {
      expect(decodeDatasetText(Buffer.from(csv, 'latin1'), contentType)).toBe(csv);
    }
  );

  it.each(['le', 'be'])('detects UTF-16%s BOM even with a conflicting HTTP charset', endian => {
    const bytes = Buffer.from('\uFEFF' + csv, 'utf16le');
    if (endian === 'be') bytes.swap16();
    expect(decodeDatasetText(bytes, 'text/csv; charset=utf-8')).toBe(csv);
  });

  it('prefers a UTF-8 BOM to a conflicting charset and preserves valid replacement characters', () => {
    expect(
      decodeDatasetText(new TextEncoder().encode('\uFEFF' + csv), 'text/csv; charset=latin1')
    ).toBe(csv);
    expect(decodeDatasetText(new TextEncoder().encode('A\uFFFDΩ中文'))).toBe('A\uFFFDΩ中文');
  });

  it('rejects unsupported charsets and malformed declared UTF-8 instead of corrupting data', () => {
    expect(() =>
      decodeDatasetText(Buffer.from(csv, 'latin1'), 'text/csv; charset=utf-8')
    ).toThrow();
    expect(() => decodeDatasetText(new Uint8Array(), 'text/csv; charset=unknown')).toThrow();
  });
});
