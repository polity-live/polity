import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ responses: [] as unknown[], queries: [] as string[] }));

vi.mock('../db', () => ({
  datasetSql: vi.fn((strings: TemplateStringsArray) => {
    mocks.queries.push(Array.from(strings).join('?'));
    return Promise.resolve(mocks.responses.shift() ?? []);
  }),
}));

import {
  assertCanContributeGroupDatasets,
  assertCanManageGroupDatasets,
  assertCanReadDataset,
  loadDatasetContributionGroupName,
  userCanContributeGroupDatasets,
  userCanManageGroupDatasets,
  userCanReadDataset,
  type DatasetAccessRecord,
} from '../access';

const baseDataset: DatasetAccessRecord = {
  id: 'dataset-1',
  visibility: 'private',
  owner_user_id: 'owner-1',
  group_id: null,
};

beforeEach(() => {
  mocks.responses.length = 0;
  mocks.queries.length = 0;
});

describe('dataset access', () => {
  it('handles public, anonymous, authenticated, owner and ungrouped visibility rules', async () => {
    await expect(userCanReadDataset(null, { ...baseDataset, visibility: 'public' })).resolves.toBe(
      true
    );
    await expect(userCanReadDataset(undefined, baseDataset)).resolves.toBe(false);
    await expect(
      userCanReadDataset('user-1', { ...baseDataset, visibility: 'authenticated' })
    ).resolves.toBe(true);
    await expect(userCanReadDataset('owner-1', baseDataset)).resolves.toBe(true);
    await expect(userCanReadDataset('user-1', baseDataset)).resolves.toBe(false);
    await expect(
      userCanReadDataset('user-1', { ...baseDataset, visibility: 'restricted' })
    ).resolves.toBe(true);
  });

  it('grants grouped reads to contributors without consulting action rights', async () => {
    mocks.responses.push([{ id: 'group-1' }]);
    await expect(
      userCanReadDataset('user-1', { ...baseDataset, group_id: 'group-1' })
    ).resolves.toBe(true);
    expect(mocks.queries).toHaveLength(1);
  });

  it.each([
    ['owner', [[{ id: 'group-1' }]], true, 2],
    ['member', [[], [{ id: 'right-1' }]], true, 3],
    ['guest', [[], [], [{ id: 'right-1' }]], true, 4],
    ['none', [[], [], []], false, 4],
  ] as const)(
    'resolves grouped %s rights through every fallback',
    async (_label, rightRows, expected, queryCount) => {
      mocks.responses.push([], ...rightRows);
      await expect(
        userCanReadDataset('user-1', { ...baseDataset, group_id: 'group-1' })
      ).resolves.toBe(expected);
      expect(mocks.queries).toHaveLength(queryCount);
    }
  );

  it('checks manage rights and exposes the positive and negative assertion contracts', async () => {
    mocks.responses.push([{ id: 'group-1' }]);
    await expect(userCanManageGroupDatasets('owner-1', 'group-1')).resolves.toBe(true);

    mocks.responses.push([], [], []);
    await expect(assertCanManageGroupDatasets('user-1', 'group-1')).rejects.toThrow(
      'You do not have permission to manage group datasets'
    );

    mocks.responses.push([{ id: 'group-1' }]);
    await expect(assertCanManageGroupDatasets('owner-1', 'group-1')).resolves.toBeUndefined();
  });

  it('asserts readable datasets for allowed and denied users', async () => {
    await expect(
      assertCanReadDataset(null, { ...baseDataset, visibility: 'public' })
    ).resolves.toBeUndefined();
    await expect(assertCanReadDataset(null, baseDataset)).rejects.toThrow(
      'You do not have access to this dataset'
    );
  });

  it('checks and asserts group contribution membership', async () => {
    mocks.responses.push([{ id: 'group-1' }], []);
    await expect(userCanContributeGroupDatasets('user-1', 'group-1')).resolves.toBe(true);
    await expect(assertCanContributeGroupDatasets('user-2', 'group-1')).rejects.toThrow(
      'You can only add datasets to your active groups'
    );

    mocks.responses.push([{ id: 'group-1' }]);
    await expect(assertCanContributeGroupDatasets('user-1', 'group-1')).resolves.toBeUndefined();
  });

  it('loads a trimmed group name and applies the upload fallback', async () => {
    mocks.responses.push([{ id: 'group-1' }], [{ name: '  Group One  ' }]);
    await expect(loadDatasetContributionGroupName('user-1', 'group-1')).resolves.toBe('Group One');

    mocks.responses.push([{ id: 'group-1' }], [{ name: null }]);
    await expect(loadDatasetContributionGroupName('user-1', 'group-1')).resolves.toBe('Own upload');
  });

  it('rejects a group that disappears after the contribution check', async () => {
    mocks.responses.push([{ id: 'group-1' }], []);
    await expect(loadDatasetContributionGroupName('user-1', 'group-1')).rejects.toThrow(
      'Dataset group was not found'
    );
  });
});
