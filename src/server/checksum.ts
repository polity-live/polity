import { createHash } from 'node:crypto';
import { stableJson } from '@/features/shared/utils/document-value';
export function checksum(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
