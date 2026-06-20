/**
 * 密码加密工具
 * 使用 Web Crypto API (SHA-256) 进行密码哈希，替代明文存储
 * 兼容旧版明文密码（通过格式检测自动判断）
 */

/** SHA-256 哈希长度为 64 位十六进制字符 */
const HASH_LEN = 64;

/** 判断是否为 SHA-256 哈希字符串 */
function isHashString(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 验证密码，兼容新旧格式：
 * - 存储的是 SHA-256 哈希 → 哈希比对
 * - 存储的是明文（旧版）→ 直接字符串比对
 */
export async function verifyPassword(input: string, storedValue: string): Promise<boolean> {
  if (isHashString(storedValue)) {
    // 新版：SHA-256 哈希存储
    const inputHash = await hashPassword(input);
    return inputHash === storedValue;
  }
  // 旧版：明文存储，直接比较
  return input === storedValue;
}
