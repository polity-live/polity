import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import {
  cleanupDatasetFlow,
  getLocalActorAccessToken,
  installDatasetProviderFakes,
  seedDatasetFlow,
} from './fixtures/domains/datasets';

test('archives a dataset and removes it from active search/details @pr', async ({
  e2eRun,
  e2eUser,
  page,
  seed,
}) => {
  await installDatasetProviderFakes(page);
  const accessToken = await getLocalActorAccessToken(e2eUser);
  const fixture = await seedDatasetFlow(e2eRun.prefix, seed.userId, seed.groupId);
  try {
    await page.goto(`/group/${seed.groupId}/operation#datasets`);
    const response = await page.evaluate(
      async ({ datasetId, token }) => {
        const result = await fetch('/api/datasets/archive', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ datasetId }),
        });
        return { ok: result.ok, body: await result.json() };
      },
      { datasetId: fixture.datasetId, token: accessToken }
    );
    expect(response).toMatchObject({ ok: true, body: { ok: true } });

    await expect
      .poll(async () => {
        const rows =
          await db()`select status from public.dataset where id = ${fixture.datasetId}::uuid`;
        return rows[0]?.status;
      })
      .toBe('archived');
    await expect
      .poll(async () => {
        const searchRows = await db()`
          select count(*)::integer as count from public.search_document
          where entity_type = 'dataset' and entity_id = ${fixture.datasetId}::uuid
        `;
        return Number(searchRows[0]?.count ?? 0);
      })
      .toBe(0);
  } finally {
    await cleanupDatasetFlow(fixture.datasetId);
  }
});
