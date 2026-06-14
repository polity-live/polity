import { gunzipSync } from 'node:zlib';

export async function readEurostatCsvResponse(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const isGzip =
    contentDisposition.toLowerCase().includes('.gz') ||
    (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  const decoded = isGzip ? gunzipSync(bytes) : bytes;
  return new TextDecoder().decode(decoded);
}
