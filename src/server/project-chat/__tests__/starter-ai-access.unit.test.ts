import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/server/studio/ai-suggestions', async original => ({
  ...(await original<typeof import('@/server/studio/ai-suggestions')>()),
  generateStudioSuggestion: mocks.generate,
}));
import { buildProjectStarterTools } from '../starter-tools';

describe('Studio tool credential ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockResolvedValue({ proposalId: 'proposal' });
  });
  it('takes the actor and model source from trusted chat context, not tool arguments', async () => {
    const descriptor = {
      provider: 'openai' as const,
      id: 'personal-model',
      source: 'byok' as const,
    };
    const tools = buildProjectStarterTools('requesting-user', 'Actual instruction', [], {
      model: descriptor,
      reasoningEffort: 'low',
    });
    const execute = tools.studio_generate_suggestion.execute!;
    await execute(
      { instruction: 'Model text', actor: 'other-user', model: { source: 'app' } } as never,
      { toolCallId: 'tool-call-1', messages: [], context: {} }
    );
    expect(mocks.generate).toHaveBeenCalledWith(
      'requesting-user',
      expect.objectContaining({ instruction: 'Actual instruction' }),
      expect.objectContaining({
        requestKey: 'tool-call-1',
        model: descriptor,
        reasoningEffort: 'low',
      })
    );
  });
});
