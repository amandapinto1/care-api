import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Database } from '../database.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

const credentialsSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
});

const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(120),
});

const errorSchema = z.object({ message: z.string() });

export async function registerAuthRoutes(app: FastifyInstance, database: Database) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post('/v1/auth/register', {
    schema: {
      tags: ['authentication'],
      body: registrationSchema,
      response: {
        201: z.object({ token: z.string(), accountId: z.string().uuid() }),
        409: errorSchema,
      },
    },
  }, async (request, reply) => {
    const passwordHash = await hashPassword(request.body.password);
    const accountId = crypto.randomUUID();
    const careProfileId = crypto.randomUUID();

    try {
      await database.transaction(async (client) => {
        await client.query(
          'INSERT INTO accounts (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
          [accountId, request.body.name, request.body.email, passwordHash],
        );
        await client.query(
          'INSERT INTO care_profiles (id, owner_account_id, display_name) VALUES ($1, $2, $3)',
          [careProfileId, accountId, request.body.name],
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return reply.code(409).send({ message: 'An account already uses this email address.' });
      }
      throw error;
    }

    return reply.code(201).send({
      token: app.jwt.sign({ sub: accountId, email: request.body.email }),
      accountId,
    });
  });

  typedApp.post('/v1/auth/login', {
    schema: {
      tags: ['authentication'],
      body: credentialsSchema,
      response: {
        200: z.object({ token: z.string(), accountId: z.string().uuid() }),
        401: errorSchema,
      },
    },
  }, async (request, reply) => {
    const result = await database.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM accounts WHERE email = $1 AND deleted_at IS NULL',
      [request.body.email],
    );
    const account = result.rows[0];

    if (!account || !(await verifyPassword(request.body.password, account.password_hash))) {
      return reply.code(401).send({ message: 'Invalid email or password.' });
    }

    return { token: app.jwt.sign({ sub: account.id, email: request.body.email }), accountId: account.id };
  });

  typedApp.get('/v1/session', {
    preHandler: async (request) => request.jwtVerify(),
    schema: {
      tags: ['authentication'],
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ accountId: z.string().uuid(), email: z.string().email() }) },
    },
  }, async (request) => ({
    accountId: request.user.sub,
    email: request.user.email,
  }));
}