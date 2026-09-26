/**
 * API Key 生成、鉴权哈希与可恢复密文（Web Crypto：Node 与浏览器同一套 API）
 */

const API_KEY_BYTE_LENGTH = 24;
const ENCRYPTION_VERSION = 'v1';
const IV_BYTE_LENGTH = 12;

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Node 全局 WebCrypto 的 CryptoKey，在只声明了 ES2022 lib 的工程里没有全局名字 */
type TCryptoKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

async function deriveEncryptionKey(secret: string): Promise<TCryptoKey> {
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET 未配置');
  }
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** 明文是否为 CV Builder API Key */
export function isApiKeyToken(token: string): boolean {
  return token.startsWith('cvk_') && token.length >= 20;
}

export function generateApiKeyPlaintext(): { plaintext: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(API_KEY_BYTE_LENGTH));
  const plaintext = `cvk_${toBase64Url(bytes)}`;
  const prefix = `${plaintext.slice(0, 12)}…`;
  return { plaintext, prefix };
}

export async function hashApiKey(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext));
  return bufferToHex(digest);
}

export async function encryptApiKey(plaintext: string, secret: string): Promise<string> {
  const key = await deriveEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${ENCRYPTION_VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptApiKey(encrypted: string, secret: string): Promise<string> {
  const [version, encodedIv, encodedCiphertext, extra] = encrypted.split('.');
  if (version !== ENCRYPTION_VERSION || !encodedIv || !encodedCiphertext || extra) {
    throw new Error('API Key 密文格式无效');
  }
  const key = await deriveEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(encodedIv) },
    key,
    fromBase64Url(encodedCiphertext)
  );
  return new TextDecoder().decode(plaintext);
}
