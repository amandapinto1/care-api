import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../database.js';

export async function registerPrivacyRoutes(app: FastifyInstance, database: Database) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const authenticate = async (request: { jwtVerify: () => Promise<unknown> }) => request.jwtVerify();
  const consent = z.object({ purpose: z.enum(['account', 'health_routine', 'notifications', 'profile_photo', 'shared_care']), policyVersion: z.string().min(1).max(64) });
  typedApp.post('/v1/consents', { preHandler: authenticate, schema: { body: consent, response: { 201: z.object({ id: z.string().uuid() }) } } }, async (request, reply) => {
    const row = await database.query<{ id: string }>('INSERT INTO consent_records (account_id, purpose, policy_version) VALUES ($1, $2, $3) RETURNING id', [request.user.sub, request.body.purpose, request.body.policyVersion]);
    return reply.code(201).send({ id: row.rows[0].id });
  });
  const dataRequest = z.object({ requestType: z.enum(['export', 'correction', 'deletion']) });
  typedApp.post('/v1/privacy/requests', { preHandler: authenticate, schema: { body: dataRequest, response: { 202: z.object({ id: z.string().uuid(), status: z.literal('pending') }) } } }, async (request, reply) => {
    const row = await database.query<{ id: string }>('INSERT INTO data_subject_requests (account_id, request_type) VALUES ($1, $2) RETURNING id', [request.user.sub, request.body.requestType]);
    return reply.code(202).send({ id: row.rows[0].id, status: 'pending' });
  });
}