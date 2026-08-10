/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cards: [] as any[] }));

vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children }: any) => <div>{children}</div>,
  CarouselContent: ({ children }: any) => <div>{children}</div>,
  CarouselItem: ({ children }: any) => <div>{children}</div>,
  CarouselNext: () => <button>next</button>,
  CarouselPrevious: () => <button>previous</button>,
}));
vi.mock('@/features/timeline/ui/cards/StatementTimelineCard', () => ({
  StatementTimelineCard: ({ statement }: any) => {
    mocks.cards.push(statement);
    return <div data-testid="statement-card">{JSON.stringify(statement)}</div>;
  },
}));

import { StatementCarousel } from '../StatementCarousel';

afterEach(cleanup);

describe('StatementCarousel branch contract', () => {
  it('maps complete and empty statement relations, votes, surveys and hashtags', () => {
    mocks.cards.length = 0;
    render(
      <StatementCarousel
        authorName="Ada"
        authorTitle="Chair"
        authorAvatar="ada.png"
        statements={
          [
            {
              id: 1,
              title: 'Statement',
              text: 'Text',
              image_url: 'image.png',
              video_url: 'video.mp4',
              group_id: 'group-1',
              group: { name: 'Group', image_url: 'group.png' },
              support_votes: [{ vote: 1 }, { vote: -1 }, { vote: 0 }],
              comment_count: 3,
              surveys: [
                {
                  question: 'Question?',
                  options: [
                    { label: 'Yes', votes: [{ id: 'vote' }] },
                    { label: 'No', votes: null },
                  ],
                },
              ],
              statement_hashtags: [
                { id: 'join-1', hashtag: { id: 'tag-1', tag: 'topic' } },
                { id: 'join-2', hashtag: null },
              ],
            },
            {
              id: 2,
              title: null,
              text: null,
              image_url: null,
              video_url: null,
              group_id: null,
              group: null,
              support_votes: null,
              comment_count: null,
              surveys: null,
              statement_hashtags: null,
            },
          ] as never
        }
      />
    );

    expect(screen.getAllByTestId('statement-card')).toHaveLength(2);
    expect(mocks.cards[0]).toEqual(
      expect.objectContaining({
        supportCount: 1,
        opposeCount: 1,
        surveyOptions: [
          { label: 'Yes', voteCount: 1 },
          { label: 'No', voteCount: 0 },
        ],
        hashtags: [{ id: 'tag-1', tag: 'topic' }],
      })
    );
    expect(mocks.cards[1]).toEqual(
      expect.objectContaining({
        title: undefined,
        content: '',
        commentCount: 0,
        surveyQuestion: undefined,
        surveyOptions: undefined,
      })
    );
  });
});
