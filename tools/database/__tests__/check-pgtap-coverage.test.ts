import { afterEach, describe, expect, it, vi } from 'vitest';

describe('pgTAP coverage checker', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('validates the complete schema, marker, inventory, and assertion matrix', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await import('../check-pgtap-coverage');

    expect(process.exitCode).toBeUndefined();
    expect(write.mock.calls.flat().join('')).toContain('Database coverage complete:');
  });
});
