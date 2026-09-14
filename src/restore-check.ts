import { GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createR2Client, decryptBackup } from './backup.js';
import { environment } from './config.js';

const execute = promisify(execFile);

async function main() {
  if (!environment.R2_BUCKET || !environment.BACKUP_OBJECT_KEY || !environment.RESTORE_DATABASE_URL) {
    throw new Error('R2_BUCKET, BACKUP_OBJECT_KEY, and RESTORE_DATABASE_URL are required.');
  }
  if (environment.RESTORE_DATABASE_URL === environment.DATABASE_URL) {
    throw new Error('RESTORE_DATABASE_URL must target an isolated database.');
  }

  const object = await createR2Client().send(new GetObjectCommand({ Bucket: environment.R2_BUCKET, Key: environment.BACKUP_OBJECT_KEY }));
  const bytes = await object.Body?.transformToByteArray();
  const authTag = object.Metadata?.authTag ?? object.Metadata?.authtag;
  if (!bytes || !object.Metadata?.iv || !authTag) throw new Error('Backup object or encryption metadata is missing.');

  const directory = await mkdtemp(join(tmpdir(), 'care-restore-'));
  const dumpPath = join(directory, 'backup.dump');
  try {
    const plaintext = decryptBackup({ ciphertext: Buffer.from(bytes), iv: Buffer.from(object.Metadata.iv, 'base64'), authTag: Buffer.from(authTag, 'base64') });
    await writeFile(dumpPath, plaintext, { mode: 0o600 });
    await execute('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', environment.RESTORE_DATABASE_URL, dumpPath]);
    console.info(JSON.stringify({ status: 'restored', key: environment.BACKUP_OBJECT_KEY }));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

await main();