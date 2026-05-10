import { describe, expect, it } from 'vitest';
import { hasRenderableContextCards, parseContextAttachments } from '../logic/contextAttachments';

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
});
