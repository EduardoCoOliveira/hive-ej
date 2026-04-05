// ─────────────────────────────────────────────────────────────
//  Token Vault — descriptografia de tokens OAuth armazenados
//  Usa AES-256-GCM via Web Crypto API (Edge-compatible)
// ─────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

async function getKey(): Promise<CryptoKey> {
  const keyData = Buffer.from(ENCRYPTION_KEY, "base64");
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Criptografa um token para armazenamento no banco.
 * Formato: iv (12 bytes) || ciphertext
 */
export async function encryptToken(plaintext: string): Promise<Buffer> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]);
}

/**
 * Descriptografa um token armazenado como BYTEA no Postgres.
 */
export async function getDecryptedToken(encryptedBytes: Buffer | Uint8Array): Promise<string> {
  const key = await getKey();
  const buf = Buffer.from(encryptedBytes);
  const iv = buf.subarray(0, 12);
  const ciphertext = buf.subarray(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
