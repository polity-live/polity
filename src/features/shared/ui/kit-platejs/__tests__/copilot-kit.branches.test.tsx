/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configFactory: null as any,
  prompt: '',
  session: undefined as undefined | { access_token?: string },
  setBlockSuggestion: vi.fn(),
}));

vi.mock('@platejs/ai/react', () => ({
  CopilotPlugin: {
    configure: (factory: any) => {
      mocks.configFactory = factory;
      return factory;
    },
  },
}));
vi.mock('@platejs/markdown', () => ({
  serializeMd: () => mocks.prompt,
  stripMarkdown: (value: string) => value,
}));
vi.mock('@/features/shared/ui/ui-platejs/ghost-text.tsx', () => ({
  GhostText: () => null,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mocks.session }),
}));
vi.mock('../markdown-kit.tsx', () => ({ MarkdownKit: [] }));

await import('../copilot-kit');

function createConfig() {
  const getOption = vi.fn(() => undefined as any);
  const setOption = vi.fn();
  const config = mocks.configFactory({
    api: { copilot: { setBlockSuggestion: mocks.setBlockSuggestion } },
    getOption,
    setOption,
  });
  return { config, getOption, setOption };
}

describe('copilot plugin branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prompt = '';
    mocks.session = undefined;
  });

  it('rejects empty and sentinel completions but accepts normal text', () => {
    const { config } = createConfig();
    config.options.completeOptions.onFinish(null, '   ');
    config.options.completeOptions.onFinish(null, '0');
    expect(mocks.setBlockSuggestion).not.toHaveBeenCalled();
    config.options.completeOptions.onFinish(null, ' completed. ');
    expect(mocks.setBlockSuggestion).toHaveBeenCalledWith({ text: 'completed.' });
  });

  it('builds prompts only from sufficiently long active blocks', () => {
    const { config } = createConfig();
    const editor = { api: { block: vi.fn() } };
    editor.api.block.mockReturnValue(undefined);
    expect(config.options.getPrompt({ editor })).toBe('');
    editor.api.block.mockReturnValue([{ type: 'p', children: [] }, [0]]);
    mocks.prompt = 'short';
    expect(config.options.getPrompt({ editor })).toBe('');
    mocks.prompt = 'A'.repeat(30);
    expect(config.options.getPrompt({ editor })).toContain(mocks.prompt);
  });

  it('updates authorization headers for signed-out and signed-in sessions', () => {
    const { config, getOption, setOption } = createConfig();
    const view = renderHook(() => config.useHooks());
    expect(setOption).toHaveBeenLastCalledWith(
      'completeOptions',
      expect.objectContaining({ headers: {} })
    );

    getOption.mockReturnValue({ headers: { Existing: 'yes' } });
    mocks.session = { access_token: 'token' };
    view.rerender();
    expect(setOption).toHaveBeenLastCalledWith(
      'completeOptions',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer token', existing: 'yes' }),
      })
    );
  });
});
