import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_TOOLS } from '@/lib/ai/defaultAiTools';
import { buildAiTools } from '../ai-tools';

describe('present_findings AI tool', () => {
  it('is always available to the model but absent from the public tool catalog', () => {
    expect(buildAiTools('user-1')).toHaveProperty('present_findings');
    expect(DEFAULT_AI_TOOLS.some(tool => tool.name === ('present_findings' as never))).toBe(false);
  });

  it('returns a validated presentation block without entity attachments', async () => {
    const findingsTool = buildAiTools('user-1').present_findings as unknown as {
      execute: (input: unknown) => Promise<unknown>;
    };
    const result = await findingsTool.execute({
      title: 'Options',
      summary: 'Two options compared.',
      items: [
        { title: 'Option A', description: 'Fast', tone: 'success' },
        { title: 'Option B', description: 'Careful', tone: 'warning' },
      ],
    });

    expect(result).toMatchObject({
      attachments: [],
      presentations: [
        {
          type: 'findings',
          title: 'Options',
          items: [
            { title: 'Option A', tone: 'success' },
            { title: 'Option B', tone: 'warning' },
          ],
        },
      ],
    });
  });
});
