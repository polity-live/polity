/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/CreateGroupSummaryStep', () => ({
  CreateGroupSummaryStep: ({ layoutId, overlayMode }: Record<string, any>) => (
    <div data-testid="group-summary" data-layout-id={layoutId} data-overlay={overlayMode} />
  ),
}));
vi.mock('../../ui/CreateSummaryStep', () => ({
  CreateSummaryStep: ({ title, layoutId, overlayMode }: Record<string, any>) => (
    <div data-layout-id={layoutId} data-overlay={overlayMode}>
      {title}
    </div>
  ),
}));

import { CreateGroupSummaryStep } from '../../ui/CreateGroupSummaryStep';
import { CreateSummaryStep } from '../../ui/CreateSummaryStep';
import { CREATE_REVIEW_CARD_LAYOUT_ID, getCreateReviewPreview } from '../createReviewPreview';

describe('getCreateReviewPreview remaining branches', () => {
  it('returns null for missing steps and steps without a review summary', () => {
    expect(getCreateReviewPreview([])).toBeNull();
    expect(
      getCreateReviewPreview([
        {
          label: 'Review',
          fields: [{ key: 'plain', kind: 'customComponent', component: () => null }],
        },
      ] as any)
    ).toBeNull();
  });

  it('finds a nested group summary and supplies default preview props', () => {
    render(
      getCreateReviewPreview([
        {
          label: 'Review',
          sections: [
            {
              fields: [
                {
                  key: 'plain',
                  kind: 'text',
                  label: 'Plain',
                  value: '',
                  onValueChange: () => undefined,
                },
              ],
            },
            {
              fields: [
                {
                  key: 'summary',
                  kind: 'customComponent',
                  component: CreateGroupSummaryStep,
                },
              ],
            },
          ],
        },
      ] as any)
    );

    expect(
      document.querySelector(`[data-layout-id="${CREATE_REVIEW_CARD_LAYOUT_ID}"]`)
    ).toBeTruthy();
  });

  it('prefers a direct summary and preserves its props', () => {
    render(
      getCreateReviewPreview([
        {
          label: 'Review',
          fields: [
            {
              key: 'summary',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: { entityType: 'statement', badge: 'Statement', title: 'Direct summary' },
            },
          ],
        },
      ] as any)
    );

    expect(screen.getByText('Direct summary')).toBeTruthy();
  });
});
