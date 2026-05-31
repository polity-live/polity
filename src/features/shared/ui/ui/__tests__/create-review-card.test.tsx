/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CreateReviewCard } from '../create-review-card';

describe('CreateReviewCard', () => {
  it('renders themed header badges, sections, and media previews', () => {
    const { container } = render(
      <CreateReviewCard
        entityType="event"
        badge="Event"
        secondaryBadge="Public"
        title="Community Town Hall"
        subtitle="Monthly update and discussion"
        hashtags={['civic', 'neighborhood']}
        media={{
          imageUrl: 'https://example.com/town-hall.jpg',
          imageAlt: 'Town hall cover',
          videoUrl: 'https://example.com/town-hall-video',
          videoLabel: 'Livestream link',
        }}
        sections={[
          {
            title: 'Basics',
            fields: [
              { label: 'Type', value: 'Meeting' },
              { label: 'Visibility', value: 'Public' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Community Town Hall')).not.toBeNull();
    expect(screen.getAllByText('Public')).toHaveLength(2);
    expect(screen.queryByText('Basics')).not.toBeNull();
    expect(screen.queryByText('Meeting')).not.toBeNull();
    expect(screen.getByAltText('Town hall cover').getAttribute('src')).toBe(
      'https://example.com/town-hall.jpg'
    );
    expect(screen.getByRole('link', { name: /town-hall-video/i }).getAttribute('href')).toBe(
      'https://example.com/town-hall-video'
    );
    expect(container.firstElementChild?.className).toContain('rounded-[28px]');
    expect(container.innerHTML).toContain('from-orange-100');
  });
});
