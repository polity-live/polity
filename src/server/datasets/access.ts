import { datasetSql as sql } from './db';

export interface DatasetAccessRecord {
  id: string;
  visibility: string;
  owner_user_id: string | null;
  group_id: string | null;
}

export async function userCanReadDataset(
  userId: string | null | undefined,
  dataset: DatasetAccessRecord
) {
  if (dataset.visibility === 'public' && !dataset.group_id) return true;
  if (!userId) return false;
  if (dataset.visibility === 'authenticated' && !dataset.group_id) return true;
  if (dataset.owner_user_id === userId) return true;
  if (!dataset.group_id) return dataset.visibility !== 'private';

  if (await userCanContributeGroupDatasets(userId, dataset.group_id)) return true;
  return userHasGroupDatasetRight(userId, dataset.group_id, 'view');
}

export async function userCanManageGroupDatasets(userId: string, groupId: string) {
  return userHasGroupDatasetRight(userId, groupId, 'manage');
}

export async function assertCanReadDataset(
  userId: string | null | undefined,
  dataset: DatasetAccessRecord
) {
  if (!(await userCanReadDataset(userId, dataset))) {
    throw new Error('You do not have access to this dataset');
  }
}

export async function assertCanManageGroupDatasets(userId: string, groupId: string) {
  if (!(await userCanManageGroupDatasets(userId, groupId))) {
    throw new Error('You do not have permission to manage group datasets');
  }
}

export async function userCanContributeGroupDatasets(userId: string, groupId: string) {
  const groups = await sql<{ id: string }[]>`
    SELECT g.id
    FROM "group" AS g
    WHERE g.id = ${groupId}
      AND (
        g.owner_id = ${userId}
        OR EXISTS (
          SELECT 1
          FROM group_membership AS gm
          WHERE gm.group_id = g.id
            AND gm.user_id = ${userId}
            AND gm.status IN ('active', 'member', 'admin')
        )
      )
    LIMIT 1
  `;
  return groups.length > 0;
}

export async function assertCanContributeGroupDatasets(userId: string, groupId: string) {
  if (!(await userCanContributeGroupDatasets(userId, groupId))) {
    throw new Error('You can only add datasets to your active groups');
  }
}

export async function loadDatasetContributionGroupName(userId: string, groupId: string) {
  await assertCanContributeGroupDatasets(userId, groupId);
  const groups = await sql<{ name: string | null }[]>`
    SELECT name
    FROM "group"
    WHERE id = ${groupId}
    LIMIT 1
  `;
  const group = groups[0];
  if (!group) throw new Error('Dataset group was not found');
  return group.name?.trim() || 'Own upload';
}

async function userHasGroupDatasetRight(
  userId: string,
  groupId: string,
  action: 'view' | 'manage'
) {
  const owned = await sql<{ id: string }[]>`
    SELECT id FROM "group"
    WHERE id = ${groupId} AND owner_id = ${userId}
    LIMIT 1
  `;
  if (owned.length > 0) return true;

  const memberRights = await sql<{ id: string }[]>`
    SELECT ar.id
    FROM group_membership AS gm
    JOIN group_membership_role AS gmr ON gmr.group_membership_id = gm.id
    JOIN role AS r ON r.id = gmr.role_id
    JOIN action_right AS ar ON ar.role_id = r.id
    WHERE gm.group_id = ${groupId}
      AND gm.user_id = ${userId}
      AND gm.status IN ('active', 'member', 'admin')
      AND ar.group_id = ${groupId}
      AND ar.resource = 'groupDatasets'
      AND (ar.action = 'manage' OR (${action} = 'view' AND ar.action = 'view'))
    LIMIT 1
  `;
  if (memberRights.length > 0) return true;

  const guestRights = await sql<{ id: string }[]>`
    SELECT ar.id
    FROM group_guest_access AS ga
    JOIN group_guest_role AS gr ON gr.group_guest_access_id = ga.id
    JOIN role AS r ON r.id = gr.role_id
    JOIN action_right AS ar ON ar.role_id = r.id
    WHERE ga.group_id = ${groupId}
      AND ga.user_id = ${userId}
      AND ga.status = 'active'
      AND ar.group_id = ${groupId}
      AND ar.resource = 'groupDatasets'
      AND (ar.action = 'manage' OR (${action} = 'view' AND ar.action = 'view'))
    LIMIT 1
  `;

  return guestRights.length > 0;
}
