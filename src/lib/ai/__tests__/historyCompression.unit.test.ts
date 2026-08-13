import { describe, expect, it } from 'vitest';

import { compressConversationHistory, estimateAiTextTokens } from '../historyCompression';

describe('AI history compression', () => {
  it('estimates normalized text and skips compression without a usable window', () => {
    expect(estimateAiTextTokens('   ')).toBe(0);
    expect(estimateAiTextTokens('abcd   efgh')).toBe(3);
    const messages = [{ role: 'user' as const, content: 'hello' }];
    expect(
      compressConversationHistory({ systemPrompt: '', messages, contextWindow: null })
    ).toEqual({
      messages,
      estimatedTokens: 10,
      wasCompressed: false,
      compressedMessageCount: 0,
    });
    expect(
      compressConversationHistory({ systemPrompt: '', messages, contextWindow: 10_000 })
        .wasCompressed
    ).toBe(false);
  });

  it('skips histories below the compression trigger', () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 ? ('assistant' as const) : ('user' as const),
      content: 'short',
    }));
    expect(
      compressConversationHistory({ systemPrompt: 'system', messages, contextWindow: 10_000 })
        .wasCompressed
    ).toBe(false);
  });

  it('returns an early candidate that fits while compacting old content', () => {
    const messages = [
      { role: 'user' as const, content: '' },
      { role: 'assistant' as const, content: 'x'.repeat(5_000) },
      ...Array.from({ length: 11 }, (_, index) => ({
        role: index % 2 ? ('assistant' as const) : ('user' as const),
        content: index === 0 ? 'short' : index < 7 ? 'y'.repeat(2_000) : 'recent',
      })),
    ];
    const result = compressConversationHistory({
      systemPrompt: 'system',
      messages,
      contextWindow: 5_000,
    });
    expect(result.wasCompressed).toBe(true);
    expect(result.compressedMessageCount).toBeGreaterThan(0);
    expect(result.messages[0].content).toContain('[empty]');
    expect(result.messages[0].content).toContain('Assistant:');
    expect(result.messages[0].content).toContain('…');
  });

  it('returns the smallest candidate when no candidate meets the target', () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 ? ('assistant' as const) : ('user' as const),
      content: 'z'.repeat(3_000),
    }));
    const result = compressConversationHistory({
      systemPrompt: 's'.repeat(5_000),
      messages,
      contextWindow: 5_000,
    });
    expect(result.wasCompressed).toBe(true);
    expect(result.estimatedTokens).toBeGreaterThan(1_024);
    expect(result.messages.length).toBeGreaterThan(1);
  });
});
