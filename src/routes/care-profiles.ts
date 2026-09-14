import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { writeAuditEvent } from '../audit.js';
import type { Database } from '../database.js';
import { requireCareProfileAccess } from '../security/authorization.js';
import { decryptSensitiveField, encryptSensitiveField, type EncryptedField } from '../security/encryption.js';

const profileParams = z.object({ profileId: z.string().uuid() });
const notFoundSchema = z.object({ message: z.string() });

export async function registerCareProfileRoutes(app: FastifyInstance, database: Database) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const authenticate = async (request: { jwtVerify: () => Promise<unknown> }) => request.jwtVerify();

  typedApp.get('/v1/care-profiles/:profileId', {
    preHandler: authenticate,
    schema: {
      tags: ['care profiles'],
      security: [{ bearerAuth: [] }],
      params: profileParams,
      response: { 200: z.object({ id: z.string().uuid(), displayName: z.string(), role: z.string() }), 404: notFoundSchema },
    },
  }, async (request, reply) => {
    let role: string;
    try {
      role = await requireCareProfileAccess(database, request.user.sub, request.params.profileId);
    } catch {
      return reply.code(404).send({ message: 'Care profile not found.' });
    }

    const result = await database.query<{ id: string; display_name: string }>(
      'SELECT id, display_name FROM care_profiles WHERE id = $1 AND deleted_at IS NULL',
      [request.params.profileId],
    );
    const profile = result.rows[0];
    if (!profile) return reply.code(404).send({ message: 'Care profile not found.' });

    return { id: profile.id, displayName: profile.display_name, role };
  });

  typedApp.post('/v1/care-profiles/:profileId/sensitive-records', {
    preHandler: authenticate,
    schema: {
      tags: ['care profiles'],
      security: [{ bearerAuth: [] }],
      params: profileParams,
      body: z.object({ category: z.string().trim().min(1).max(80), payload: z.record(z.string(), z.unknown()) }),
      response: { 201: z.object({ id: z.string().uuid() }), 404: notFoundSchema },
    },
  }, async (request, reply) => {
    try {
      await requireCareProfileAccess(database, request.user.sub, request.params.profileId);
    } catch {
      return reply.code(404).send({ message: 'Care profile not found.' });
    }

    const id = crypto.randomUUID();
    const encrypted = encryptSensitiveField(request.body.payload);
    await database.transaction(async (client) => {
      await client.query(
        `INSERT INTO sensitive_records (id, care_profile_id, category, encrypted_payload, key_reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, request.params.profileId, request.body.category, JSON.stringify(encrypted), encrypted.keyReference],
      );
      await writeAuditEvent(client, {
        actorAccountId: request.user.sub,
        careProfileId: request.params.profileId,
        action: 'sensitive_record.created',
        entityType: 'sensitive_record',
        entityId: id,
        resultingVersion: '1',
      });
    });

    return reply.code(201).send({ id });
  });

  typedApp.get('/v1/care-profiles/:profileId/sensitive-records/:recordId', {
    preHandler: authenticate,
    schema: {
      tags: ['care profiles'],
      security: [{ bearerAuth: [] }],
      params: profileParams.extend({ recordId: z.string().uuid() }),
      response: { 200: z.object({ id: z.string().uuid(), category: z.string(), payload: z.record(z.string(), z.unknown()) }), 404: notFoundSchema },
    },
  }, async (request, reply) => {
    try {
      await requireCareProfileAccess(database, request.user.sub, request.params.profileId);
    } catch {
      return reply.code(404).send({ message: 'Care profile not found.' });
    }

    const result = await database.query<{ id: string; category: string; encrypted_payload: EncryptedField }>(
      'SELECT id, category, encrypted_payload FROM sensitive_records WHERE id = $1 AND care_profile_id = $2',
      [request.params.recordId, request.params.profileId],
    );
    const record = result.rows[0];
    if (!record) return reply.code(404).send({ message: 'Sensitive record not found.' });

    return {
      id: record.id,
      category: record.category,
      payload: decryptSensitiveField<Record<string, unknown>>(record.encrypted_payload),
    };
  });
}