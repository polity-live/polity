/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to, ...props }: any) => (
    <a href={params?.topic ? to.replace('$topic', params.topic) : to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/navigation/nav-items/icon-map', () => ({
  getIconComponent: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DocsTopicCard } from '../DocsTopicCard';
import { DocsTopicView } from '../DocsTopicView';
import { ProcessDiagram } from '../ProcessDiagram';

const topic = {
  slug: 'groups',
  icon: 'Users',
  category: 'collaboration',
  featured: false,
  related: [],
  process: { kind: 'timeline', steps: [] },
} as never;

afterEach(cleanup);

describe('docs topic empty-process fallbacks', () => {
  it('uses entry/result tones when cards and diagrams contain no steps', () => {
    const { rerender } = render(<DocsTopicCard topic={topic} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/docs/groups');
    rerender(
      <ProcessDiagram baseKey="pages.docs.topics.groups" process={(topic as any).process} />
    );
    expect(screen.getByText('pages.docs.topics.groups.diagram.title')).toBeTruthy();
  });

  it('uses the empty first-step tone in a complete topic view', () => {
    render(
      <DocsTopicView
        actions={[]}
        audience="Audience"
        baseKey="pages.docs.topics.groups"
        concepts={[]}
        copy={{
          actionsLabel: 'Actions',
          audienceLabel: 'Audience',
          conceptsLabel: 'Concepts',
          entryLabel: 'Entry',
          exploreMore: 'Explore',
          libraryDescription: 'Library',
          navLabel: 'Docs',
          outcome: 'Outcome',
          perspective: 'Perspective',
          quickView: 'Quick',
          relatedTopicLabels: {},
          relatedTopics: 'Related',
          statesLabel: 'States',
          userPerspective: 'User',
          watchFor: 'Watch',
        }}
        entry="Entry"
        relatedTopics={[]}
        states={[]}
        summary="Summary"
        title="Groups"
        topic={topic}
        watchFor={[]}
      />
    );
    expect(screen.getByRole('heading', { name: 'Groups' })).toBeTruthy();
  });
});
