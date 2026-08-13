import { describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => ({
  close: vi.fn(),
  createInterface: vi.fn(),
  question: vi.fn(),
}));

vi.mock('node:readline/promises', () => ({ createInterface: prompt.createInterface }));

import { confirmProduction as confirmAuthTemplates } from '../deploy-auth-templates';
import { confirmProduction as confirmPolityTemplate } from '../deploy-template';

describe('interactive email deployment prompts', () => {
  it('uses the default readline boundary for both production deployment CLIs', async () => {
    prompt.question.mockResolvedValue(' expected ');
    prompt.createInterface.mockReturnValue({
      close: prompt.close,
      question: prompt.question,
    });

    await expect(
      confirmAuthTemplates('expected', undefined, { inputIsTTY: true, outputIsTTY: true })
    ).resolves.toBeUndefined();
    await expect(
      confirmPolityTemplate('expected', undefined, { inputIsTTY: true, outputIsTTY: true })
    ).resolves.toBeUndefined();

    expect(prompt.createInterface).toHaveBeenCalledTimes(2);
    expect(prompt.close).toHaveBeenCalledTimes(2);
  });
});
