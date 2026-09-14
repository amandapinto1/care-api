import type { DatabaseClient } from './database.js';

export async function writeAuditEvent(
  client: DatabaseClient,
  input: {
    actorAccountId: string;
    careProfileId?: string;
    action: string;
    entityType: string;
    entityId: string;
    priorVersion?: string;
    resultingVersion?: string;
    rationale?: string;
  },
) {
  await client.query(
    `INSERT INTO audit_events
      (actor_account_id, care_profile_id, action, entity_type, entity_id, prior_version, resulting_version, rationale)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.actorAccountId,
      input.careProfileId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.priorVersion ?? null,
      input.resultingVersion ?? null,
      input.rationale ?? null,
    ],
  );
}