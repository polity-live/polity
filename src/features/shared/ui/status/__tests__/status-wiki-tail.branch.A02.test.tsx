/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/badge', () => ({
  Badge: ({ children, ...props }: ComponentProps<'span'>) => <span {...props}>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/theme', () => ({
  getBadgeToneClasses: (tone: string) => `badge-${tone}`,
  getEntityToneClasses: (tone: string) => ({ badge: `entity-${tone}`, dot: `dot-${tone}` }),
  getSemanticToneClasses: (tone: string) => ({ dot: `dot-${tone}`, text: `text-${tone}` }),
}));

import { RightBadgeBase } from '../StatusBadges';
import { EntityWikiMedia } from '../../wiki/EntityWikiMedia';

afterEach(cleanup);

describe('status and wiki tail branches A02', () => {
  it('uses the right name when badge children are omitted', () => {
    render(<RightBadgeBase right="manage">{undefined as never}</RightBadgeBase>);
    expect(screen.getByText('manage')).toBeTruthy();
  });

  it('renders the narrowed image URL after the empty-media guard', () => {
    render(<EntityWikiMedia imageUrl="image.png" videoUrl={null} alt="Preview" />);
    expect(screen.getByRole('img', { name: 'Preview' }).getAttribute('src')).toBe('image.png');
  });
});
