import type { Database } from '../database.js';

export type CareRole = 'owner' | 'responsible' | 'accompanied' | 'caregiver' | 'additional_responsible';

export async function requireCareProfileAccess(
  database: Database,
  accountId: string,
  careProfileId: string,
): Promise<CareRole> {
  const result = await database.query<{ role: CareRole }>(
    `SELECT 'owner'::text AS role FROM care_profiles
     WHERE id = $1 AND owner_account_id = $2 AND deleted_at IS NULL
     UNION ALL
     SELECT role::text FROM care_relationships
     WHERE care_profile_id = $1 AND account_id = $2 AND status = 'active'
     LIMIT 1`,
    [careProfileId, accountId],
  );

  const role = result.rows[0]?.role;
  if (!role) {
    throw new Error('CARE_PROFILE_ACCESS_DENIED');
  }

  return role;
}