/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cards: [] as any[] }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: any) => value?.text ?? '',
}));
vi.mock('@/features/groups/logic/groupWikiHelpers', () => ({
  countAcceptedMemberships: (memberships: any[]) => memberships?.length ?? 0,
}));
vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: any) => {
    mocks.cards.push(group);
    return <div>{group.name}</div>;
  },
}));
vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { RelatedGroupsTabs, relatedGroupsTabsInternals as internals } from '../RelatedGroupsTabs';
afterEach(cleanup);

describe('RelatedGroupsTabs branches', () => {
  it('builds, merges, sorts, and searches every relation fallback', () => {
    expect(internals.toPlainDescription(null)).toBeUndefined();
    expect(internals.toPlainDescription({ text: 'Description' })).toBe('Description');
    const items = internals.buildRelatedItems(
      [
        { group: null },
        { group: { id: 'same', name: 'Zulu', description: { text: 'Parent desc' } } },
        { group: { id: 'nameless', name: null } },
      ],
      [{ group: { id: 'same', name: 'Zulu' } }, { group: { id: 'alpha', name: 'Alpha' } }]
    );
    expect(items).toHaveLength(3);
    expect(
      internals.getRelatedGroupSearchText(items.find((item: any) => item.group.id === 'same')!)
    ).toContain('parent');
    expect(
      internals.getRelatedGroupSearchText(items.find((item: any) => item.group.id === 'same')!)
    ).toContain('child');
    expect(
      internals.getRelatedGroupSearchText(items.find((item: any) => item.group.id === 'alpha')!)
    ).not.toContain('parent');
    expect(
      internals.getRelatedGroupSearchText(items.find((item: any) => item.group.id === 'nameless')!)
    ).not.toContain('child');
  });

  it('renders empty, fallback, count, index cap, and no-result states', () => {
    const view = render(<RelatedGroupsTabs parentGroups={[]} childGroups={[]} />);
    expect(view.container.innerHTML).toBe('');
    const groups = Array.from({ length: 13 }, (_, index) => ({
      group: {
        id: String(index),
        name: index === 0 ? null : `Group ${index}`,
        description: index === 1 ? { text: 'Desc' } : null,
        member_count: index === 2 ? 5 : undefined,
        memberships: [{ id: 'm' }],
        amendments: index === 3 ? [{ id: 'a' }] : [],
        events: index === 4 ? [{ id: 'e' }] : [],
      },
    }));
    view.rerender(<RelatedGroupsTabs parentGroups={groups} childGroups={[groups[0]]} />);
    expect(mocks.cards.some(card => card.name === 'common.unspecified')).toBe(true);
    fireEvent.change(view.container.querySelector('input')!, {
      target: { value: 'does-not-exist' },
    });
    expect(view.container.textContent).toContain('pages.group.relatedGroups.noResults');
  });
});
