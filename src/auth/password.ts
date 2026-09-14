import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, encodedKey] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !encodedKey) {
    return false;
  }

  const expectedKey = Buffer.from(encodedKey, 'base64url');
  const actualKey = await scrypt(password, salt, expectedKey.length) as Buffer;

  return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
}