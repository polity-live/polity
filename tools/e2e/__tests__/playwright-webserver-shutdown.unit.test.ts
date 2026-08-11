import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLAYWRIGHT_CONFIG = path.resolve(process.cwd(), 'playwright.config.ts');

describe('Playwright web server shutdown contract', () => {
  it('bounds graceful shutdown for both managed web servers', async () => {
    const source = await fs.readFile(PLAYWRIGHT_CONFIG, 'utf8');

    expect(source).toContain(
      "const webServerGracefulShutdown = { signal: 'SIGTERM' as const, timeout: 10_000 }"
    );
    expect(source.match(/gracefulShutdown: webServerGracefulShutdown/g) ?? []).toHaveLength(2);
  });
});
