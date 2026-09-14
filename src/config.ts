import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).default('development-only-jwt-secret-change-before-production'),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().min(3).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  BACKUP_OBJECT_KEY: z.string().min(1).optional(),
  RESTORE_DATABASE_URL: z.string().url().optional(),
});

export const environment = environmentSchema.parse(process.env);