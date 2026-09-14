import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { environment } from './config.js';

const execute = promisify(execFile);

export type EncryptedBackup = { ciphertext: Buffer; iv: Buffer; authTag: Buffer };

export function backupKey() {
  if (!environment.BACKUP_ENCRYPTION_KEY) throw new Error('BACKUP_ENCRYPTION_KEY is required.');
  const key = Buffer.from(environment.BACKUP_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptBackup(plaintext: Buffer): EncryptedBackup {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', backupKey(), iv);
  return { ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]), iv, authTag: cipher.getAuthTag() };
}

export function decryptBackup(encrypted: EncryptedBackup): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', backupKey(), encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
}

export function createR2Client() {
  if (!environment.R2_ENDPOINT || !environment.R2_ACCESS_KEY_ID || !environment.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required.');
  }
  return new S3Client({
    endpoint: environment.R2_ENDPOINT,
    region: 'auto',
    credentials: { accessKeyId: environment.R2_ACCESS_KEY_ID, secretAccessKey: environment.R2_SECRET_ACCESS_KEY },
  });
}

async function main() {
  if (!environment.DATABASE_URL || !environment.R2_BUCKET) throw new Error('DATABASE_URL and R2_BUCKET are required.');
  const { stdout } = await execute('pg_dump', ['--format=custom', '--no-owner', '--dbname', environment.DATABASE_URL], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  const encrypted = encryptBackup(stdout as Buffer);
  const key = `postgres/${new Date().toISOString().replaceAll(':', '-')}.dump.enc`;
  await createR2Client().send(new PutObjectCommand({
    Bucket: environment.R2_BUCKET,
    Key: key,
    Body: encrypted.ciphertext,
    Metadata: { algorithm: 'aes-256-gcm', iv: encrypted.iv.toString('base64'), authTag: encrypted.authTag.toString('base64') },
    ServerSideEncryption: 'AES256',
  }));
  console.info(JSON.stringify({ status: 'uploaded', key }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}