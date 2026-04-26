const textEncoder = new TextEncoder();
const IV_LENGTH = 12;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.AI_ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error('AI_ENCRYPTION_SECRET is not configured');
  }

  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));

  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(secretValue: string): Promise<string> {
  const encryptionKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    textEncoder.encode(secretValue)
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivRaw, ciphertextRaw] = payload.split('.');

  if (!ivRaw || !ciphertextRaw) {
    throw new Error('Encrypted AI credential payload is malformed');
  }

  const encryptionKey = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivRaw) },
    encryptionKey,
    fromBase64(ciphertextRaw)
  );

  return new TextDecoder().decode(plaintext);
}

export function maskSecret(secretValue: string): string {
  const trimmed = secretValue.trim();

  if (trimmed.length <= 8) {
    return '********';
  }

  return `••••••${trimmed.slice(-4)}`;
}
