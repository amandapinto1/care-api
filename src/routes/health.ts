import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/health', {
    schema: {
      tags: ['system'],
      response: {
        200: z.object({ status: z.literal('ok') }),
      },
    },
  }, async () => ({ status: 'ok' as const }));
}