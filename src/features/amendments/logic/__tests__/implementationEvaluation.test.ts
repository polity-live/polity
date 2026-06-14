import { describe, expect, it } from 'vitest';
import {
  deriveImplementationDisplayStatus,
  formatImplementationEvaluationSummary,
  getImplementationReviewOutcomeLabel,
  resolveImplementationReviewVoteOutcome,
} from '../implementationEvaluation';

describe('implementationEvaluation helpers', () => {
  it('formats fixed and relative evaluation summaries for review/wiki displays', () => {
    expect(
      formatImplementationEvaluationSummary({
        mode: 'fixed_date',
        fixedDate: '2026-06-30',
      })
    ).toMatch(/30\D0?6\D2026/);

    expect(
      formatImplementationEvaluationSummary({
        mode: 'relative_to_vote',
        offsetYears: 1,
        offsetMonths: 2,
      })
    ).toBe('1 Jahr, 2 Monate nach Annahme');
  });

  it('maps the supplementary implementation display status onto the agreed wiki labels', () => {
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'pending_event',
        implementationStatus: null,
      })
    ).toBe('In Bearbeitung');
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'completed',
        implementationStatus: 'awaiting_evaluation',
      })
    ).toBe('Angenommen und Umsetzung');
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'completed',
        implementationStatus: 'evaluation_in_vote',
      })
    ).toBe('In Abstimmung');
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'completed',
        implementationStatus: 'implemented',
      })
    ).toBe('Umgesetzt');
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'completed',
        implementationStatus: 'implementation_failed',
      })
    ).toBe('Umsetzung verfehlt');
  });

  it('derives yes, no, and tie outcomes from implementation review votes', () => {
    const baseVote = {
      majority_type: 'simple',
      choices: [
        { id: 'choice-yes', label: 'yes', order_index: 1 },
        { id: 'choice-no', label: 'no', order_index: 2 },
      ],
      offline_tallies: [],
      voters: [{}, {}, {}],
      final_participations: [{}, {}, {}],
    };

    expect(
      resolveImplementationReviewVoteOutcome({
        ...baseVote,
        final_decisions: [{ choice_id: 'choice-yes' }, { choice_id: 'choice-yes' }],
      })
    ).toBe('yes');
    expect(
      resolveImplementationReviewVoteOutcome({
        ...baseVote,
        final_decisions: [{ choice_id: 'choice-no' }, { choice_id: 'choice-no' }],
      })
    ).toBe('no');
    expect(
      resolveImplementationReviewVoteOutcome({
        ...baseVote,
        final_decisions: [{ choice_id: 'choice-yes' }, { choice_id: 'choice-no' }],
      })
    ).toBe('tie');
    expect(getImplementationReviewOutcomeLabel('tie')).toBe('Stimmengleichstand');
  });
});
