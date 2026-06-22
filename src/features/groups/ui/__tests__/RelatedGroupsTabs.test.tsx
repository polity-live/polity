/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RelatedGroupsTabs } from '../RelatedGroupsTabs';

vi.mock('@/features/shared/hooks/use-translation', () => {
  const translations: Record<string, string> = {
    'common.labels.all': 'Alle',
    'pages.group.childGroups.title': 'Untergeordnete Gruppen',
    'pages.group.parentGroups.title': 'Übergeordnete Gruppen',
    'pages.group.relatedGroups.searchPlaceholder': 'Verwandte Gruppen suchen',
  };

  return {
    translate: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    }),
  };
});

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: { name: string } }) => (
    <article data-testid="group-card">{group.name}</article>
  ),
}));

function activePanelText() {
  return document.querySelector('[role="tabpanel"][data-state="active"]')?.textContent ?? '';
}

function selectTab(name: string) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

describe('RelatedGroupsTabs', () => {
  it('shows only child groups in the child tab and only parent groups in the parent tab', () => {
    render(
      <RelatedGroupsTabs
        parentGroups={[{ group: { id: 'parent-a', name: 'Parent A' } }]}
        childGroups={[{ group: { id: 'child-a', name: 'Child A' } }]}
      />
    );

    expect(activePanelText()).toContain('Child A');
    expect(activePanelText()).toContain('Parent A');

    selectTab('Untergeordnete Gruppen');

    expect(activePanelText()).toContain('Child A');
    expect(activePanelText()).not.toContain('Parent A');

    selectTab('Übergeordnete Gruppen');

    expect(activePanelText()).toContain('Parent A');
    expect(activePanelText()).not.toContain('Child A');
  });
});
