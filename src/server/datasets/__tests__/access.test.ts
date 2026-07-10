import { beforeEach, describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({ datasetSql: sql }));

import {
  loadDatasetContributionGroupName,
  userCanContributeGroupDatasets,
  userCanReadDataset,
} from '../access';

describe('dataset contribution access', () => {
  beforeEach(() => sql.mockReset());

  it('returns the name of a group the user actively belongs to', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'group-id' }])
      .mockResolvedValueOnce([{ name: 'Example group' }]);

    await expect(loadDatasetContributionGroupName('user-id', 'group-id')).resolves.toBe(
      'Example group'
    );
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('rejects groups without ownership or an active membership', async () => {
    sql.mockResolvedValueOnce([]);
    await expect(userCanContributeGroupDatasets('user-id', 'other-group')).resolves.toBe(false);
  });

  it('allows active group members to read group-wide datasets', async () => {
    sql.mockResolvedValueOnce([{ id: 'group-id' }]);

    await expect(
      userCanReadDataset('user-id', {
        id: 'dataset-id',
        visibility: 'private',
        owner_user_id: 'another-user',
        group_id: 'group-id',
      })
    ).resolves.toBe(true);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
