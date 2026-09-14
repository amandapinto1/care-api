import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { environment } from './config.js';
import { Database } from './database.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCareProfileRoutes } from './routes/care-profiles.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerPrivacyRoutes } from './routes/privacy.js';

export async function createApp(database = new Database()) {
  const app = Fastify({ logger: environment.NODE_ENV !== 'test' });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cors, { origin: environment.NODE_ENV === 'production' ? false : true });
  await app.register(jwt, { secret: environment.JWT_SECRET });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Care API', version: '0.1.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/documentation' });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app, database);
  await registerCareProfileRoutes(app, database);
  await registerPrivacyRoutes(app, database);

  app.addHook('onClose', async () => database.close());
  return app;
}