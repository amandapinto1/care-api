import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', {
    schema: {
      tags: ['system'],
      response: {
        200: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string' } },
        },
      },
    },
  }, async () => ({ status: 'ok' }));
}