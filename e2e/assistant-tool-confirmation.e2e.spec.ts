import { expect, test } from './fixtures/test';
import { installCommunicationBoundaryFakes } from './fixtures/domains/communications';

test('receives a local AI stream and confirms its tool intent @nightly', async ({ page }) => {
  const ledger = await installCommunicationBoundaryFakes(page);
  await page.goto('/messages?openAriaKai=true');
  const events = await page.evaluate(async () => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Archive the dataset' }] }),
    });
    return (await response.text())
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { type: string; toolName?: string; text?: string });
  });
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'text-delta', text: 'The dataset can be archived.' }),
      expect.objectContaining({ type: 'tool-call', toolName: 'archiveDataset' }),
      expect.objectContaining({ type: 'tool-result', toolName: 'archiveDataset' }),
    ])
  );
  expect(ledger.aiRequests).toBe(1);
});
