// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, layoutId, ...props }: any) => (
      <div data-layout-id={layoutId} {...props}>
        {children}
      </div>
    ),
  },
}));

vi.mock('@/features/shared/theme', () => ({
  getContentTypeToneClasses: (type: string) => ({
    badge: `content-badge-${type}`,
    border: `content-border-${type}`,
    text: `content-text-${type}`,
  }),
  getEntityGradientClasses: (type: string) => `gradient-${type}`,
  getEntityToneClasses: (type: string) => ({
    badge: `entity-badge-${type}`,
    border: `entity-border-${type}`,
    text: `entity-text-${type}`,
  }),
  getSemanticToneClasses: (type: string) => ({ badge: `semantic-${type}` }),
}));

vi.mock('@/features/shared/logic/hashtagHelpers', () => ({
  getHashtagGradient: (tag: string) => `hashtag-${tag}`,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/ui/aspect-ratio', () => ({
  AspectRatio: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/badge.tsx', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children, ...props }: any) => <article {...props}>{children}</article>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <i className={className} />;
  return {
    Award: Icon,
    BookOpen: Icon,
    Building2: Icon,
    Calendar: Icon,
    CheckSquare: Icon,
    ExternalLink: Icon,
    FileText: Icon,
    GitBranch: Icon,
    Image: Icon,
    ImageIcon: Icon,
    ListOrdered: Icon,
    PlayCircle: Icon,
    Quote: Icon,
    User: Icon,
    Video: Icon,
    Vote: Icon,
    Wallet: Icon,
    Zap: Icon,
  };
});

import { CreateReviewCard, SummaryField, SummaryPillList } from '../CreateReviewCard';

afterEach(cleanup);

describe('CreateReviewCard', () => {
  it('renders the default empty statement review', () => {
    const { container } = render(<CreateReviewCard badge="Statement" title="Draft" />);
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText(/no_review_details_available/)).toBeTruthy();
    expect(container.querySelector('.gradient-statement')).toBeTruthy();
  });

  it('normalizes supplied gradient formats and optional header content', () => {
    const gradient = render(
      <CreateReviewCard
        entityType="role"
        badge="Role"
        secondaryBadge="Public"
        title="Chair"
        subtitle="Coordinates work"
        hashtags={['council']}
        gradient="bg-gradient-custom"
        overlayMode
        className="review"
      >
        <div>Child details</div>
      </CreateReviewCard>
    );
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Coordinates work')).toBeTruthy();
    expect(screen.getByText('#council').className).toContain('hashtag-council');
    expect(screen.getByText('Child details')).toBeTruthy();
    expect(gradient.container.querySelector('article')?.className).toContain('max-h-');
    gradient.unmount();

    const background = render(
      <CreateReviewCard badge="Blog" title="Blog" gradient="bg-red-500" hashtags={[]} />
    );
    expect(background.container.querySelector('.bg-red-500')).toBeTruthy();
    background.unmount();

    const raw = render(
      <CreateReviewCard badge="Event" title="Event" gradient="from-blue-500 to-red-500" />
    );
    expect(raw.container.querySelector('.bg-gradient-to-br')).toBeTruthy();
  });

  it('renders summary fields for primitive and node values and pill lists', () => {
    const empty = render(<SummaryPillList items={[]} />);
    expect(empty.container.firstChild).toBeNull();
    empty.unmount();

    render(
      <>
        <SummaryField label="Text" value="Value" />
        <SummaryField label="Number" value={42} />
        <SummaryField label="Node" value={<strong>Strong value</strong>} className="field" />
        <SummaryPillList items={['one', 'two']} className="pills" />
      </>
    );
    expect(screen.getByText('Value').tagName).toBe('SPAN');
    expect(screen.getByText('42').tagName).toBe('SPAN');
    expect(screen.getByText('Strong value').tagName).toBe('STRONG');
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
  });

  it('renders every section combination and skips empty sections', () => {
    const { container } = render(
      <CreateReviewCard
        badge="Review"
        title="Sections"
        sections={[
          {},
          { title: 'One field', fields: [{ label: 'Name', value: 'Ada' }] },
          {
            columns: 1,
            description: 'Two fields description',
            fields: [
              { label: 'First', value: 'A' },
              { label: 'Second', value: 'B' },
            ],
          },
          {
            fields: [
              { label: 'Auto first', value: 'One' },
              { label: 'Auto second', value: 'Two' },
            ],
          },
          { content: <div>Content only</div> },
          {
            content: <div>Fields and content</div>,
            fields: [{ label: 'Combined', value: 'Yes' }],
            title: 'Combined section',
          },
        ]}
      />
    );
    expect(screen.getByText('One field')).toBeTruthy();
    expect(screen.getByText('Two fields description')).toBeTruthy();
    expect(screen.getByText('Content only')).toBeTruthy();
    expect(screen.getByText('Fields and content').parentElement?.className).toContain('mt-4');
    expect(container.querySelectorAll('section')).toHaveLength(5);
    const definitions = screen.getByText('Auto first').closest('dl');
    expect(definitions?.className).toContain('md:grid-cols-2');
    expect(
      [...(definitions?.children ?? [])].every(
        field =>
          field.children.length === 2 &&
          field.children[0]?.tagName === 'DT' &&
          field.children[1]?.tagName === 'DD'
      )
    ).toBe(true);
  });

  it('renders image-only, video-only, combined, and empty media previews', () => {
    const image = render(
      <CreateReviewCard badge="Image" title="Image title" media={{ imageUrl: '/image.png' }} />
    );
    expect(screen.getByRole('img').getAttribute('alt')).toBe('Image title');
    image.unmount();

    const video = render(
      <CreateReviewCard
        badge="Video"
        title="Video title"
        media={{ videoUrl: 'https://example.test/video' }}
      />
    );
    expect(screen.getByText(/review_the_selected_video_link/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.test/video');
    expect(screen.getByRole('link').parentElement?.className).toContain('max-w-full');
    video.unmount();

    const combined = render(
      <CreateReviewCard
        badge="Media"
        title="Combined"
        media={{
          imageAlt: 'Custom alt',
          imageUrl: '/both.png',
          videoLabel: 'Watch this',
          videoUrl: 'https://example.test/both',
        }}
      />
    );
    expect(screen.getByAltText('Custom alt')).toBeTruthy();
    expect(screen.getByText('Watch this')).toBeTruthy();
    expect(combined.container.innerHTML).toContain('lg:grid-cols-[minmax(0,1fr)_280px]');
    combined.unmount();

    const empty = render(<CreateReviewCard badge="Empty media" title="Empty" media={{}} />);
    expect(empty.container.querySelector('img')).toBeNull();
  });

  it('wraps a card in motion when a layout id is provided', () => {
    const { container } = render(
      <CreateReviewCard badge="Animated" title="Motion" layoutId="review-card" />
    );
    expect(container.querySelector('[data-slot="create-review-card-motion"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-id="review-card"]')).toBeTruthy();
  });
});
