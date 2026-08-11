import { describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => ({ close: vi.fn(), createInterface: vi.fn(), question: vi.fn() }));
vi.mock('node:readline/promises', () => ({ createInterface: prompt.createInterface }));

import { promptDeployTargets, runDeployCli } from '../deploy.mjs';

describe('deployment default prompt boundary', () => {
  it('uses default reporter, streams, and readline factory', async () => {
    prompt.question.mockResolvedValue('');
    prompt.createInterface.mockReturnValue({ close: prompt.close, question: prompt.question });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(promptDeployTargets()).resolves.toEqual({
      vercel: true,
      supabase: true,
      fly: true,
    });
    expect(prompt.close).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalled();

    prompt.question.mockResolvedValue('n');
    await expect(
      runDeployCli({
        args: [],
        inputIsTTY: true,
        reporter: {
          error: vi.fn(),
          info: vi.fn(),
          step: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
        },
      })
    ).resolves.toMatchObject({ deployed: false, reason: 'no-targets' });
  });
});
