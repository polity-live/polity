import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
const run = promisify(execFile);
const savedDatabase = readFileSync('output/local-stack/test-database.json', 'utf8');
const name = JSON.parse(savedDatabase).name;
const env = { ...process.env, COLLABORATION_TEST_DATABASE: name };
async function tool(target: string, extra: Record<string, string> = {}) {
  return run(process.execPath, ['--import', 'tsx', 'tools/collaboration/launch.ts', target], {
    env: { ...env, ...extra },
    windowsHide: true,
    timeout: 360_000,
    maxBuffer: 2_000_000,
  });
}
test('HTTP and ten real WebSocket editors enforce rights, proposals, comments, recovery and reconnection', async () => {
  const { stdout } = await tool('acceptance');
  expect(stdout).toContain('PASS');
  expect(
    JSON.parse(readFileSync('output/collaboration-migration/api-acceptance.json', 'utf8')).passed
  ).toBe(true);
});
test('process death before and after commit replays once and excludes a second writer', async () => {
  await tool('faults');
  const result = JSON.parse(readFileSync('output/collaboration-migration/faults.json', 'utf8'));
  expect(result.passed).toBe(true);
  expect(result.checks).toContain('death-after-commit-before-delivery');
});
test('tutorial uses shared storage and keeps immutable decisions when its sandbox closes', async () => {
  const { stdout } = await tool('tutorial-acceptance');
  expect(stdout).toContain('PASS');
});
test('all seven Studio exports refer to confirmed shared revisions and contain valid media', async () => {
  test.setTimeout(360_000);
  const runtime = JSON.parse(readFileSync('output/local-stack/runtime.json', 'utf8'));
  await tool('studio-acceptance', { FFMPEG_PATH: runtime.ffmpegPath });
  expect(
    JSON.parse(readFileSync('output/collaboration-migration/studio-acceptance.json', 'utf8')).passed
  ).toBe(true);
});
test('committed conversion retries and both rollback paths retain legacy history and new acknowledgements', async () => {
  try {
    await run(process.execPath, ['tools/collaboration/local-stack.mjs', 'clone'], {
      windowsHide: true,
      timeout: 120_000,
    });
    const copy = JSON.parse(readFileSync('output/local-stack/test-database.json', 'utf8')).name;
    await tool('rehearsal', {
      COLLABORATION_TEST_DATABASE: copy,
      COLLABORATION_REHEARSAL_LIFECYCLE: '1',
    });
    const result = JSON.parse(
      readFileSync('output/collaboration-migration/lifecycle.json', 'utf8')
    );
    expect(result.passed).toBe(true);
    expect(result.checks).toContain('compatibility-retains-all-revisions-and-branches');
  } finally {
    writeFileSync('output/local-stack/test-database.json', savedDatabase);
    await run(process.execPath, ['tools/collaboration/local-stack.mjs', 'start'], {
      env,
      windowsHide: true,
      timeout: 300_000,
    });
  }
});
test('a complete stack restart preserves confirmed content, rights, decisions and comments', async () => {
  test.setTimeout(360_000);
  await tool('restart');
  expect(
    JSON.parse(readFileSync('output/collaboration-migration/restart-proof.json', 'utf8')).passed
  ).toBe(true);
});
test('Studio media operations preserve private visibility, validate uploads and support authorized ranged downloads', async () => {
  const { stdout } = await run(
    process.execPath,
    ['--import', 'tsx', 'tools/e2e/studio/smoke-service.ts'],
    { env, windowsHide: true, timeout: 180_000, maxBuffer: 2_000_000 }
  );
  expect(stdout).toContain('private/public media visibility, durable handoff, ranged download');
});
test('standalone Studio exporter retains editable slides, embedded clips and complete campaign archives', async () => {
  const runtime = JSON.parse(readFileSync('output/local-stack/runtime.json', 'utf8'));
  const { stdout } = await run(
    process.execPath,
    ['--import', 'tsx', 'tools/e2e/studio/smoke-export.ts'],
    {
      env: { ...env, FFMPEG_PATH: runtime.ffmpegPath },
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 2_000_000,
    }
  );
  for (const format of ['png', 'pdf', 'pptx', 'canva', 'xlsx', 'zip'])
    expect(stdout).toContain(`${format}: verified`);
});
