import { describe, expect, it } from 'vitest';

import {
  BASE_ARIA_KAI_SYSTEM_PROMPT,
  buildCurrentTurnUserContent,
  buildHistoricUserContent,
  buildSystemPrompt,
} from '../prompts';

const basicAttachment = {
  entityType: 'group' as const,
  entityId: 'group-1',
  title: 'Civic Lab',
  href: '/group/group-1',
};

describe('AI prompts', () => {
  it('builds the base prompt with optional trimmed user context', () => {
    expect(buildSystemPrompt()).toBe(BASE_ARIA_KAI_SYSTEM_PROMPT);
    expect(buildSystemPrompt([], '   ')).toBe(BASE_ARIA_KAI_SYSTEM_PROMPT);
    expect(buildSystemPrompt([], '  User Ada, locale de  ')).toContain(
      'Current Polity user context:\nUser Ada, locale de'
    );
  });

  it('adds each selected skill only once by slug', () => {
    const prompt = buildSystemPrompt([
      { slug: 'research', name: 'Research', systemPrompt: 'Compare sources.' },
      { slug: 'research', name: 'Duplicate', systemPrompt: 'Do not include.' },
      { slug: 'draft', name: 'Draft', systemPrompt: 'Draft a proposal.' },
    ]);

    expect(prompt).toContain('Active skill: Research (/research)\nCompare sources.');
    expect(prompt).toContain('Active skill: Draft (/draft)\nDraft a proposal.');
    expect(prompt).not.toContain('Duplicate');
  });

  it('formats current-turn attachments with optional subtitle and context', () => {
    expect(buildCurrentTurnUserContent('Hello', [])).toBe('Hello');
    const content = buildCurrentTurnUserContent('Compare these', [
      {
        ...basicAttachment,
        subtitle: 'Berlin',
        prompt_context: '  14 active members  ',
      },
      { ...basicAttachment, entityId: 'group-2', title: 'Second', prompt_context: '   ' },
    ]);

    expect(content).toContain('- group: Civic Lab (Berlin)\n  Context: 14 active members');
    expect(content).toContain('- group: Second');
  });

  it('formats historic context with and without message text', () => {
    expect(buildHistoricUserContent('  Earlier question  ', null)).toBe('Earlier question');
    expect(buildHistoricUserContent(null, null)).toBe('');

    const contextJson = JSON.stringify([basicAttachment]);
    expect(buildHistoricUserContent('  Earlier question  ', contextJson)).toContain(
      'Earlier question\nAttached Polity context:'
    );
    expect(buildHistoricUserContent(null, contextJson)).toBe(
      'Attached Polity context:\n- group: Civic Lab'
    );
  });
});
