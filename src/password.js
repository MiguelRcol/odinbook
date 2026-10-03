import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, hash) {
  const [algorithm, salt, expected] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const key = await scrypt(password, salt, 64);
  const buffer = Buffer.from(expected, 'hex');
  return buffer.length === key.length && timingSafeEqual(buffer, key);
}
