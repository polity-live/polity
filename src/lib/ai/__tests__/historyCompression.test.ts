import { describe, expect, it } from 'vitest';
import { compressConversationHistory, estimateAiTextTokens } from '../historyCompression';

describe('historyCompression', () => {
  it('leaves short conversations untouched', () => {
    const result = compressConversationHistory({
      systemPrompt: 'You are Aria & Kai.',
      contextWindow: 200000,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    });

    expect(result.wasCompressed).toBe(false);
    expect(result.messages).toHaveLength(2);
  });

  it('compresses earlier turns when the context window is nearly full', () => {
    const longTurn = 'A'.repeat(2200);
    const messages = Array.from({ length: 16 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `${index + 1}: ${longTurn}`,
    }));

    const uncompressedTokens = estimateAiTextTokens(
      messages.map(message => message.content).join(' ')
    );
    const result = compressConversationHistory({
      systemPrompt: 'You are Aria & Kai.',
      contextWindow: Math.max(5000, Math.floor(uncompressedTokens * 1.05)),
      messages,
    });

    expect(result.wasCompressed).toBe(true);
    expect(result.compressedMessageCount).toBeGreaterThan(0);
    expect(result.messages[0]?.content).toContain('Earlier conversation history was compressed');
    expect(result.messages.at(-1)?.content).toContain(longTurn);
  });
});
