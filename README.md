# Care server

Run `docker compose up --build` from `remedy/` after providing a local `FIELD_ENCRYPTION_KEY`.

The API is available at `http://localhost:3000`; OpenAPI documentation is at `/documentation`.

## Backups

Set the R2 and backup variables from `.env.example` in Railway Shared Variables and link them only to the worker or scheduled backup service. Run `npm run backup` on a schedule. Each PostgreSQL custom-format dump is encrypted with AES-256-GCM before it is uploaded to R2 and uses R2 server-side encryption as a second layer.

Keep `BACKUP_ENCRYPTION_KEY` outside Railway as a recovery secret. It must differ from `FIELD_ENCRYPTION_KEY`. Set `BACKUP_OBJECT_KEY` to an uploaded backup and `RESTORE_DATABASE_URL` to an isolated database, then run `npm run restore-check`. The command rejects the primary `DATABASE_URL` to prevent production restoration.