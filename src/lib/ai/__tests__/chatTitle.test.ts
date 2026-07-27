import { describe, expect, it } from 'vitest';
import {
  MAX_ASSISTANT_CONVERSATION_TITLE_LENGTH,
  normalizeAssistantConversationTitle,
} from '../chatTitle';

describe('normalizeAssistantConversationTitle', () => {
  it('removes Markdown formatting and escaped underscore separators', () => {
    expect(
      normalizeAssistantConversationTitle(String.raw`**Zölln\_ganz\_neue\_Chat\_Neu\_anlegen**`)
    ).toBe('Zölln ganz neue Chat Neu anlegen');
  });

  it.each([
    ['**Unvollständig formatierter Titel', 'Unvollständig formatierter Titel'],
    ['`Titel in Backticks`', 'Titel in Backticks'],
    ['„Titel in Anführungszeichen“', 'Titel in Anführungszeichen'],
    ['Titel___mit__mehreren_Unterstrichen', 'Titel mit mehreren Unterstrichen'],
  ])('normalizes surrounding formatting in %s', (input, expected) => {
    expect(normalizeAssistantConversationTitle(input)).toBe(expected);
  });

  it('collapses whitespace and line breaks', () => {
    expect(
      normalizeAssistantConversationTitle('  Kommunale   Beteiligung\n sinnvoll gestalten  ')
    ).toBe('Kommunale Beteiligung sinnvoll gestalten');
  });

  it('keeps plain titles unchanged', () => {
    expect(normalizeAssistantConversationTitle('C++ und Bürger*innen')).toBe(
      'C++ und Bürger*innen'
    );
  });

  it('cleans formatting before limiting titles to 60 characters', () => {
    const title = normalizeAssistantConversationTitle(`**${'Ä'.repeat(80)}**`);

    expect(Array.from(title ?? '')).toHaveLength(MAX_ASSISTANT_CONVERSATION_TITLE_LENGTH);
    expect(title).toBe('Ä'.repeat(MAX_ASSISTANT_CONVERSATION_TITLE_LENGTH));
  });

  it.each([' \n\t ', '****', '``'])('rejects empty title %j', title => {
    expect(normalizeAssistantConversationTitle(title)).toBeNull();
  });
});
