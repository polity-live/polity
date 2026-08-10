import { inflateRawSync } from 'node:zlib';

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readUInt16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function findSignature(bytes: Uint8Array, signature: number, start: number, end: number) {
  for (let offset = start; offset >= end; offset--) {
    if (readUInt32LE(bytes, offset) === signature) return offset;
  }
  return -1;
}

export function unzipFirstTextFile(bytes: Uint8Array) {
  const eocdOffset = findSignature(bytes, 0x06054b50, bytes.length - 22, 0);
  if (eocdOffset < 0) {
    return new TextDecoder().decode(bytes);
  }

  let centralEntryOffset = readUInt32LE(bytes, eocdOffset + 16);
  let compressionMethod: number;
  let compressedSize: number;
  let localHeaderOffset: number;

  while (true) {
    if (readUInt32LE(bytes, centralEntryOffset) !== 0x02014b50) {
      throw new Error('ZIP_CENTRAL_DIRECTORY_NOT_FOUND');
    }

    compressionMethod = readUInt16LE(bytes, centralEntryOffset + 10);
    compressedSize = readUInt32LE(bytes, centralEntryOffset + 20);
    const fileNameLength = readUInt16LE(bytes, centralEntryOffset + 28);
    const extraLength = readUInt16LE(bytes, centralEntryOffset + 30);
    const commentLength = readUInt16LE(bytes, centralEntryOffset + 32);
    localHeaderOffset = readUInt32LE(bytes, centralEntryOffset + 42);
    const fileName = new TextDecoder().decode(
      bytes.slice(centralEntryOffset + 46, centralEntryOffset + 46 + fileNameLength)
    );

    if (fileName && !fileName.endsWith('/')) break;

    centralEntryOffset += 46 + fileNameLength + extraLength + commentLength;
    if (readUInt32LE(bytes, centralEntryOffset) !== 0x02014b50) {
      throw new Error('ZIP_HAS_NO_FILE_ENTRY');
    }
  }

  if (readUInt32LE(bytes, localHeaderOffset) !== 0x04034b50) {
    throw new Error('ZIP_LOCAL_HEADER_NOT_FOUND');
  }
  const localNameLength = readUInt16LE(bytes, localHeaderOffset + 26);
  const localExtraLength = readUInt16LE(bytes, localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    return new TextDecoder().decode(compressed);
  }
  if (compressionMethod === 8) {
    return new TextDecoder().decode(inflateRawSync(compressed));
  }

  throw new Error(`ZIP_UNSUPPORTED_COMPRESSION_${compressionMethod}`);
}
