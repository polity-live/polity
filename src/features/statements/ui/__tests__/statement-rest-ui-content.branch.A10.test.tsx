/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  surveyModel: {} as Record<string, unknown>,
  surveyViewProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/statements/hooks/useStatementSurvey', () => ({
  useStatementSurvey: () => mocks.surveyModel,
}));
vi.mock('../StatementSurveyView', async importOriginal => {
  const actual = await importOriginal<typeof import('../StatementSurveyView')>();
  return actual;
});
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

import { StatementMediaDisplay } from '../StatementMediaDisplay';
import { StatementSurvey } from '../StatementSurvey';
import { StatementSurveyView } from '../StatementSurveyView';
import {
  canViewExpiredStatement,
  cleanStatementString,
  deriveStatementMediaType,
  getStatementHeadline,
  hasStatementContent,
  isStatementExpired,
} from '@/zero/statements/content';
import { createStatementSchema, updateStatementSchema } from '@/zero/statements/schema';

beforeEach(() => {
  mocks.surveyModel = {
    percentages: [],
    totalVotes: 0,
    userVote: null,
    isExpired: false,
    timeRemaining: '1h',
  };
});
afterEach(cleanup);

describe('remaining statement UI and content A10', () => {
  it('renders no media, default/custom images, videos with/without posters', () => {
    const view = render(<StatementMediaDisplay />);
    expect(view.container.firstChild).toBeNull();
    view.rerender(<StatementMediaDisplay imageUrl="image" />);
    expect(screen.getByRole('img').getAttribute('alt')).toBe(
      'generated.inline.0171_statement_media_7c323153'
    );
    view.rerender(<StatementMediaDisplay imageUrl="image" alt="custom" className="custom" />);
    expect(screen.getByAltText('custom')).toBeTruthy();
    view.rerender(<StatementMediaDisplay videoUrl="video" imageUrl="poster" />);
    expect(view.container.querySelector('video')?.getAttribute('poster')).toBe('poster');
    view.rerender(<StatementMediaDisplay videoUrl="video" />);
    expect(view.container.querySelector('video')?.hasAttribute('poster')).toBe(false);
  });

  it('maps active and expired survey models into translated view labels', () => {
    const survey = { id: 'survey', question: 'Question', ends_at: Date.now(), options: [] };
    const view = render(<StatementSurvey survey={survey} />);
    expect(screen.getByText('features.statements.survey.endsIn 1h')).toBeTruthy();
    mocks.surveyModel = {
      percentages: [],
      totalVotes: 2,
      userVote: null,
      isExpired: true,
      timeRemaining: null,
    };
    view.rerender(<StatementSurvey survey={survey} />);
    expect(screen.getByText('features.statements.survey.expired')).toBeTruthy();
  });

  it('covers fresh vote, selected result, change, expired, and retract actions', () => {
    const vote = vi.fn();
    const retract = vi.fn();
    const base = {
      className: 'custom',
      isExpired: false,
      onRetract: retract,
      onVote: vote,
      options: [
        { optionId: 'a', label: 'A', percent: 60 },
        { optionId: 'b', label: 'B', percent: 40 },
      ],
      question: 'Question',
      retractLabel: 'Retract',
      timeLabel: '1h',
      totalVotesLabel: '2 votes',
      userVote: null,
    };
    const view = render(<StatementSurveyView {...base} />);
    fireEvent.click(screen.getByText('A'));
    expect(vote).toHaveBeenCalledWith('a');
    view.rerender(<StatementSurveyView {...base} userVote={{ id: 'vote-1', option_id: 'a' }} />);
    fireEvent.click(screen.getByText('B').closest('button')!);
    fireEvent.click(screen.getByText('Retract'));
    expect(vote).toHaveBeenCalledWith('b', 'vote-1');
    expect(retract).toHaveBeenCalledWith('vote-1');
    view.rerender(
      <StatementSurveyView {...base} isExpired userVote={{ id: '', option_id: 'a' }} />
    );
    expect(screen.queryByText('Retract')).toBeNull();
    view.rerender(
      <StatementSurveyView {...base} userVote={{ id: null, option_id: 'a' } as never} />
    );
    fireEvent.click(screen.getByText('Retract'));
    expect(retract).toHaveBeenLastCalledWith('');
  });

  it('covers statement content normalization, headline, media, and expiry invariants', () => {
    expect(cleanStatementString(' ')).toBeNull();
    expect(cleanStatementString(' text ')).toBe('text');
    expect(deriveStatementMediaType(undefined, 'video')).toBe('video');
    expect(deriveStatementMediaType('image')).toBe('image');
    expect(deriveStatementMediaType()).toBe('text');
    expect(hasStatementContent({})).toBe(false);
    expect(hasStatementContent({ image_url: 'image' })).toBe(true);
    expect(getStatementHeadline({ title: 'Title' })).toBe('Title');
    expect(getStatementHeadline({ text: 'Short\nSecond' })).toBe('Short');
    expect(getStatementHeadline({ text: 'x'.repeat(80) })).toMatch(/\.\.\.$/);
    expect(getStatementHeadline({ video_url: 'video' })).toContain('video');
    expect(getStatementHeadline({ image_url: 'image' })).toContain('photo');
    expect(getStatementHeadline({}, 'Fallback')).toBe('Fallback');
    expect(isStatementExpired(null, 10)).toBe(false);
    expect(isStatementExpired({ is_story: true, expires_at: 9 }, 10)).toBe(true);
    expect(
      canViewExpiredStatement({ is_story: true, expires_at: 9, user_id: 'u1' }, 'u1', 10)
    ).toBe(true);
    expect(
      canViewExpiredStatement({ is_story: true, expires_at: 9, user_id: 'u1' }, null, 10)
    ).toBe(false);
    expect(canViewExpiredStatement({ is_story: false }, null, 10)).toBe(true);
  });

  it('rejects empty, dual-media, and mismatched statement schema content', () => {
    const base = {
      group_id: null,
      title: null,
      text: null,
      image_url: null,
      video_url: null,
      media_type: 'text' as const,
      is_story: false,
      expires_at: null,
      visibility: 'public',
    };
    expect(createStatementSchema.safeParse({ ...base, id: 'empty' }).success).toBe(false);
    expect(
      createStatementSchema.safeParse({
        ...base,
        id: 'dual',
        image_url: 'image',
        video_url: 'video',
        media_type: 'video',
      }).success
    ).toBe(false);
    expect(
      createStatementSchema.safeParse({
        ...base,
        id: 'mismatch',
        image_url: 'image',
        media_type: 'text',
      }).success
    ).toBe(false);
    expect(createStatementSchema.safeParse({ ...base, id: 'valid', text: 'Text' }).success).toBe(
      true
    );
    const { media_type: _mediaType, ...derivedMedia } = base;
    expect(
      createStatementSchema.safeParse({ ...derivedMedia, id: 'derived', image_url: 'image' })
        .success
    ).toBe(true);
    expect(updateStatementSchema.safeParse({ id: 's1' }).success).toBe(true);
  });
});
