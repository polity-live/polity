import { afterEach, describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, maskSecret } from '../ai-crypto';

const originalSecret = process.env.AI_ENCRYPTION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.AI_ENCRYPTION_SECRET;
  } else {
    process.env.AI_ENCRYPTION_SECRET = originalSecret;
  }
});

describe('AI credential encryption', () => {
  it('round-trips a secret with a random authenticated payload', async () => {
    process.env.AI_ENCRYPTION_SECRET = 'test-encryption-secret';
    const first = await encryptSecret('credential-value');
    const second = await encryptSecret('credential-value');

    expect(first).not.toBe(second);
    expect(first.split('.')).toHaveLength(2);
    await expect(decryptSecret(first)).resolves.toBe('credential-value');
  });

  it('requires the encryption secret for encryption and valid decryption', async () => {
    delete process.env.AI_ENCRYPTION_SECRET;
    await expect(encryptSecret('credential-value')).rejects.toThrow(
      'AI_ENCRYPTION_SECRET is not configured'
    );
    await expect(decryptSecret('a.b')).rejects.toThrow('AI_ENCRYPTION_SECRET is not configured');
  });

  it.each(['', 'missing-dot', '.ciphertext', 'iv.'])(
    'rejects malformed payload %j',
    async payload => {
      process.env.AI_ENCRYPTION_SECRET = 'test-encryption-secret';
      await expect(decryptSecret(payload)).rejects.toThrow(
        'Encrypted AI credential payload is malformed'
      );
    }
  );

  it('rejects a payload encrypted with a different key', async () => {
    process.env.AI_ENCRYPTION_SECRET = 'first-secret';
    const payload = await encryptSecret('credential-value');
    process.env.AI_ENCRYPTION_SECRET = 'second-secret';
    await expect(decryptSecret(payload)).rejects.toThrow();
  });

  it('masks short values completely and exposes only the trimmed suffix of long values', () => {
    expect(maskSecret('  short  ')).toBe('********');
    expect(maskSecret('  long-credential-value  ')).toBe('••••••alue');
  });
});
