import { describe, expect, it } from 'vitest';

import { COPILOT_MIN_PROMPT_CHARACTERS, shouldRequestCopilotSuggestion } from '../copilot-kit';

describe('CopilotKit', () => {
  it('does not request suggestions for short prompts', () => {
    expect(shouldRequestCopilotSuggestion('Short context')).toBe(false);
  });

  it('requests suggestions once the normalized prompt has enough context', () => {
    const prompt = 'A'.repeat(COPILOT_MIN_PROMPT_CHARACTERS);

    expect(shouldRequestCopilotSuggestion(prompt)).toBe(true);
  });

  it('normalizes markdown and whitespace before checking prompt length', () => {
    expect(shouldRequestCopilotSuggestion('**tiny**     text')).toBe(false);
  });
});
