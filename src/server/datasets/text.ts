/** Decode original CSV bytes before parsing; stored snapshots are written as UTF-8. */
export function decodeDatasetText(bytes: Uint8Array, contentType?: string | null): string {
  // A byte-order mark is stronger evidence than a server's charset declaration.
  let encoding: string | undefined;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8';
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  else {
    const charset = contentType?.match(
      /(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i
    );
    encoding = (charset?.[1] ?? charset?.[2] ?? charset?.[3])?.trim();
    if (!encoding && contentType && !contentType.includes('/') && !contentType.includes(';')) {
      encoding = contentType.trim() || undefined;
    }
  }

  if (encoding) {
    // Do not silently replace invalid input when the source declares its encoding.
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // German open-data CSVs commonly use Windows-1252 / ISO-8859-1.
    return new TextDecoder('windows-1252', { fatal: true }).decode(bytes);
  }
}
