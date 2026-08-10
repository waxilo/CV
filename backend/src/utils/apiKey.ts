/**
 * API Key 生成与哈希（Cloudflare Workers / Web Crypto）
 *
 * 明文格式：cvk_<base64url>
 * 仅存 SHA-256(明文)，请求时用哈希等值查找账号。
 */

const API_KEY_BYTE_LENGTH = 24;

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

/** 明文是否为 CV Builder API Key */
export function isApiKeyToken(token: string): boolean {
  return token.startsWith('cvk_') && token.length >= 20;
}

/**
 * 生成新的 API Key 明文与展示前缀。
 */
export function generateApiKeyPlaintext(): { plaintext: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(API_KEY_BYTE_LENGTH));
  const plaintext = `cvk_${toBase64Url(bytes)}`;
  // 展示用：cvk_ + 前 8 位，便于列表识别
  const prefix = `${plaintext.slice(0, 12)}…`;
  return { plaintext, prefix };
}

/**
 * SHA-256 十六进制哈希，用于入库与鉴权查找。
 */
export async function hashApiKey(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext));
  return bufferToHex(digest);
}
