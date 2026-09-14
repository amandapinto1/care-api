import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { environment } from '../config.js';

export type EncryptedField = {
  algorithm: 'aes-256-gcm';
  version: 1;
  keyReference: 'environment:FIELD_ENCRYPTION_KEY';
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptedDataKey: string;
  dataKeyIv: string;
  dataKeyAuthTag: string;
};

function masterKey() {
  if (!environment.FIELD_ENCRYPTION_KEY) {
    throw new Error('FIELD_ENCRYPTION_KEY is required to process sensitive health data.');
  }

  const key = Buffer.from(environment.FIELD_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }

  return key;
}

function encrypt(value: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);

  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function encryptSensitiveField(value: unknown): EncryptedField {
  const dataKey = randomBytes(32);
  const payload = encrypt(Buffer.from(JSON.stringify(value), 'utf8'), dataKey);
  const wrappedDataKey = encrypt(dataKey, masterKey());

  return {
    algorithm: 'aes-256-gcm',
    version: 1,
    keyReference: 'environment:FIELD_ENCRYPTION_KEY',
    ciphertext: payload.ciphertext.toString('base64'),
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    encryptedDataKey: wrappedDataKey.ciphertext.toString('base64'),
    dataKeyIv: wrappedDataKey.iv.toString('base64'),
    dataKeyAuthTag: wrappedDataKey.authTag.toString('base64'),
  };
}

function decrypt(ciphertext: string, iv: string, authTag: string, key: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
}

export function decryptSensitiveField<Value>(encrypted: EncryptedField): Value {
  if (encrypted.algorithm !== 'aes-256-gcm' || encrypted.version !== 1) {
    throw new Error('Unsupported encrypted field format.');
  }

  const dataKey = decrypt(
    encrypted.encryptedDataKey,
    encrypted.dataKeyIv,
    encrypted.dataKeyAuthTag,
    masterKey(),
  );
  const plaintext = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, dataKey);

  return JSON.parse(plaintext.toString('utf8')) as Value;
}