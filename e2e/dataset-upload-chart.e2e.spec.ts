import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import {
  cleanupDatasetFlow,
  getLocalActorAccessToken,
  installDatasetProviderFakes,
} from './fixtures/domains/datasets';

test('uploads CSV, creates a projection, and exposes chart points @pr @critical @acceptance', async ({
  e2eUser,
  page,
  seed,
}) => {
  await installDatasetProviderFakes(page);
  const accessToken = await getLocalActorAccessToken(e2eUser);
  await page.goto(`/group/${seed.groupId}/operation#datasets`);
  const upload = await page.evaluate(
    async ({ groupId, token }) => {
      const formData = new FormData();
      formData.set('groupId', groupId);
      formData.set('title', 'E2E climate projection');
      formData.set(
        'file',
        new File(['Year,Value\n2025,10\n2026,14'], 'climate.csv', { type: 'text/csv' })
      );
      const response = await fetch('/api/datasets/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      return { ok: response.ok, status: response.status, body: await response.json() };
    },
    { groupId: seed.groupId, token: accessToken }
  );
  expect(upload.ok, JSON.stringify(upload.body)).toBe(true);
  const datasetId = String(upload.body.datasetId);
  const snapshotId = String(upload.body.snapshotId);
  try {
    const projection = await page.evaluate(
      async ({ snapshotId: id, token }) => {
        const response = await fetch(`/api/datasets/${id}/projection`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            view: 'chart',
            dimensionColumn: 'Year',
            measureColumn: 'Value',
            aggregation: 'sum',
            filters: {},
            limit: 25,
          }),
        });
        return { ok: response.ok, body: await response.json() };
      },
      { snapshotId, token: accessToken }
    );
    expect(projection.ok, JSON.stringify(projection.body)).toBe(true);
    expect(projection.body.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: '2025', value: 10 }),
        expect.objectContaining({ x: '2026', value: 14 }),
      ])
    );
    const rows = await db()`select status from public.dataset where id = ${datasetId}::uuid`;
    expect(rows[0]?.status).toBe('active');
  } finally {
    await cleanupDatasetFlow(datasetId);
  }
});
