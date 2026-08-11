import { describe, expect, it } from 'vitest';
import {
  buildAssistantErrorContextJson,
  hasRenderableContextCards,
  isAssistantErrorContext,
  parseContextAttachments,
  parseContextPresentations,
} from '../logic/contextAttachments';

describe('contextAttachments', () => {
  it('parses persisted ai attachments from message context', () => {
    expect(
      parseContextAttachments(
        JSON.stringify([
          {
            entityType: 'group',
            entityId: 'group-1',
            title: 'My group',
            subtitle: null,
            prompt_context: null,
            card_data_json: '{"cardType":"group","cardProps":{}}',
          },
        ])
      )
    ).toHaveLength(1);
  });

  it('rejects a malformed legacy attachment collection at the parser boundary', () => {
    expect(
      parseContextAttachments(
        JSON.stringify([
          null,
          'not-an-object',
          { entityType: 'group', entityId: 'group-1' },
          { entityType: 'group', entityId: 'group-1', title: 'Group' },
        ])
      )
    ).toEqual([]);
  });

  it('treats non-skill attachments as renderable output cards', () => {
    expect(
      hasRenderableContextCards(
        JSON.stringify([
          {
            entityType: 'skill',
            entityId: 'skill-1',
            title: 'Create tool',
          },
          {
            entityType: 'event',
            entityId: 'event-1',
            title: 'Town hall',
          },
        ])
      )
    ).toBe(true);
    expect(
      hasRenderableContextCards(
        JSON.stringify([
          {
            entityType: 'skill',
            entityId: 'skill-1',
            title: 'Create tool',
          },
        ])
      )
    ).toBe(false);
  });

  it('parses V1 findings and treats presentation-only context as renderable', () => {
    const context = JSON.stringify({
      version: 1,
      attachments: [],
      presentations: [
        {
          type: 'findings',
          id: 'comparison',
          title: 'Comparison',
          items: [
            { id: 'a', title: 'A', description: 'First', tone: 'neutral' },
            { id: 'b', title: 'B', description: 'Second', tone: 'success' },
          ],
        },
      ],
    });

    expect(parseContextPresentations(context)).toHaveLength(1);
    expect(hasRenderableContextCards(context)).toBe(true);
  });

  it('builds and detects persisted assistant error context markers', () => {
    const contextJson = buildAssistantErrorContextJson();

    expect(isAssistantErrorContext(contextJson)).toBe(true);
    expect(parseContextAttachments(contextJson)).toEqual([]);
  });

  it('rejects absent, malformed, array, and unrelated error contexts', () => {
    expect(isAssistantErrorContext()).toBe(false);
    expect(isAssistantErrorContext('{')).toBe(false);
    expect(isAssistantErrorContext('[]')).toBe(false);
    expect(isAssistantErrorContext(JSON.stringify({ kind: 'other' }))).toBe(false);
  });
});
