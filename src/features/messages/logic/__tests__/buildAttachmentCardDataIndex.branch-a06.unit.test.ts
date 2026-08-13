import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAttachmentCardDataIndex } from '../buildAttachmentCardDataIndex';

const mocks = vi.hoisted(() => ({
  richText: vi.fn(),
  buildCard: vi.fn(),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: mocks.richText,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'Fallback agenda item',
}));
vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: mocks.buildCard,
}));

describe('buildAttachmentCardDataIndex exhaustive branches', () => {
  beforeEach(() => {
    mocks.richText.mockReset().mockReturnValue('Rich text');
    mocks.buildCard.mockReset().mockImplementation((item: any) => {
      if (item.title === 'no-card-type') return { cardType: null, cardProps: { agendaItem: item } };
      if (item.title === 'no-card-props') return { cardType: 'agenda_item', cardProps: null };
      return { cardType: 'agenda_item', cardProps: { agendaItem: item } };
    });
  });

  it('preserves option card data and skips duplicate agenda items', () => {
    const result = buildAttachmentCardDataIndex({
      attachmentOptions: [
        { key: 'agenda_item:existing', attachment: { card_data_json: '{"existing":true}' } },
        { key: 'empty', attachment: { card_data_json: '' } },
      ],
      agendaItems: [
        { id: 'existing', title: 'Must not rebuild' },
        { id: 'new', title: 'New', description: undefined, created_at: undefined },
      ],
    });
    expect(result.get('agenda_item:existing')).toBe('{"existing":true}');
    expect(result.has('empty')).toBe(false);
    expect(mocks.buildCard).toHaveBeenCalledTimes(1);
    expect(mocks.buildCard.mock.calls[0][0]).toMatchObject({
      title: 'New',
      description: undefined,
      createdAt: new Date(0),
      updatedAt: undefined,
      eventName: undefined,
    });
  });

  it('normalizes dates, descriptions and every title fallback', () => {
    const updated = new Date('2026-08-09T13:00:00Z');
    const result = buildAttachmentCardDataIndex({
      attachmentOptions: [],
      agendaItems: [
        { id: 'nulls', title: '', type: '', description: null, updated_at: null, created_at: null },
        {
          id: 'typed',
          title: '',
          type: 'vote',
          description: 'Plain',
          updated_at: updated,
          created_at: 1,
          event: { title: 'Event' },
        },
        { id: 'rich', title: 'Rich', description: { type: 'doc' }, created_at: '2026-08-09' },
        { id: 'empty-rich', title: 'Empty rich', description: {}, created_at: 2 },
      ],
    });
    expect(result.size).toBe(4);
    const items = mocks.buildCard.mock.calls.map(call => call[0]);
    expect(items[0]).toMatchObject({ title: 'Fallback agenda item', description: null });
    expect(items[1]).toMatchObject({ title: 'vote', description: 'Plain', updatedAt: updated });
    expect(items[1].createdAt).toBe(updated);
    expect(items[1].eventName).toBe('Event');
    expect(items[2].createdAt).toEqual(new Date('2026-08-09'));

    mocks.richText.mockReturnValueOnce('Rich text').mockReturnValueOnce('');
    buildAttachmentCardDataIndex({
      attachmentOptions: [],
      agendaItems: [
        { id: 'rich-again', title: 'Rich again', description: {} },
        { id: 'empty-again', title: 'Empty again', description: {} },
      ],
    });
    const latestItems = mocks.buildCard.mock.calls.slice(-2).map(call => call[0]);
    expect(latestItems[0].description).toBe('Rich text');
    expect(latestItems[1].description).toBeNull();
  });

  it('omits agenda items when either card discriminator or props cannot be built', () => {
    const result = buildAttachmentCardDataIndex({
      attachmentOptions: [],
      agendaItems: [
        { id: 'one', title: 'no-card-type' },
        { id: 'two', title: 'no-card-props' },
      ],
    });
    expect(result.size).toBe(0);
  });
});
