import { beforeEach, describe, expect, it } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  deriveImplementationDisplayStatus,
  formatImplementationEvaluationDate,
  formatImplementationEvaluationOffset,
  formatImplementationEvaluationSummary,
  getImplementationEvaluationModeLabel,
  getImplementationReviewOutcomeLabel,
  normalizeAmendmentProcessStatus,
  normalizeImplementationEvaluationMode,
  normalizeImplementationEvaluationStatus,
  resolveImplementationReviewVoteOutcome,
} from '../implementationEvaluation';

describe('implementationEvaluation helpers', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
  });

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
    ).toBe('Angenommen und in Umsetzung');
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

  it('uses English implementation copy when English is active', () => {
    useLanguageStore.setState({ language: 'en' });

    expect(
      formatImplementationEvaluationSummary({
        mode: 'relative_to_vote',
        offsetYears: 1,
        offsetMonths: 2,
      })
    ).toBe('1 year, 2 months after adoption');
    expect(
      deriveImplementationDisplayStatus({
        processStatus: 'pending_event',
        implementationStatus: null,
      })
    ).toBe('In progress');
    expect(getImplementationReviewOutcomeLabel('tie')).toBe('Tie');
  });

  it.each([
    ['none', 'none'],
    ['fixed_date', 'fixed_date'],
    ['relative_to_vote', 'relative_to_vote'],
    ['unsupported', null],
    [null, null],
  ] as const)('normalizes implementation mode %s', (input, expected) => {
    expect(normalizeImplementationEvaluationMode(input)).toBe(expected);
  });

  it.each([
    'awaiting_evaluation',
    'evaluation_scheduled',
    'evaluation_in_vote',
    'implementation_window',
    'implemented',
    'implementation_failed',
    'withdrawn',
  ] as const)('preserves implementation status %s', status => {
    expect(normalizeImplementationEvaluationStatus(status)).toBe(status);
  });

  it('rejects unknown and absent implementation statuses', () => {
    expect(normalizeImplementationEvaluationStatus('unknown')).toBeNull();
    expect(normalizeImplementationEvaluationStatus(undefined)).toBeNull();
  });

  it.each([
    'pending_event',
    'scheduled',
    'in_vote',
    'approved',
    'rejected',
    'merged',
    'withdrawn',
    'completed',
  ] as const)('preserves amendment process status %s', status => {
    expect(normalizeAmendmentProcessStatus(status)).toBe(status);
  });

  it('rejects unknown and absent process statuses', () => {
    expect(normalizeAmendmentProcessStatus('unknown')).toBeNull();
    expect(normalizeAmendmentProcessStatus(null)).toBeNull();
  });

  it('formats timestamps, local dates, explicit locales, and invalid values', () => {
    expect(formatImplementationEvaluationDate(null)).toBeNull();
    expect(formatImplementationEvaluationDate('')).toBeNull();
    expect(formatImplementationEvaluationDate('not-a-date')).toBeNull();
    expect(formatImplementationEvaluationDate(Date.UTC(2026, 0, 2), 'en-US')).toMatch(/2026/);
    expect(
      formatImplementationEvaluationDate('2026-01-02', 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    ).toBe('01/02/2026');

    useLanguageStore.setState({ language: 'en' });
    expect(formatImplementationEvaluationDate('2026-01-02')).toMatch(/1\/2\/2026/);
  });

  it('formats zero, month-only, year-only, clamped, and combined offsets', () => {
    expect(formatImplementationEvaluationOffset({})).toBe('0 Monate');
    expect(formatImplementationEvaluationOffset({ months: 3 })).toBe('3 Monate');
    expect(formatImplementationEvaluationOffset({ years: 1, months: 0 })).toBe('1 Jahr');
    expect(formatImplementationEvaluationOffset({ years: -2, months: -4 })).toBe('0 Monate');
    expect(formatImplementationEvaluationOffset({ years: 2, months: 1 })).toBe('2 Jahre, 1 Monat');
  });

  it('formats each summary and missing fixed-date fallback', () => {
    expect(
      formatImplementationEvaluationSummary({ mode: 'fixed_date', fixedDate: 'invalid' })
    ).toBe('Kein Datum');
    expect(
      formatImplementationEvaluationSummary({ mode: 'relative_to_vote', offsetMonths: 0 })
    ).toBe('0 Monate nach Annahme');
    expect(formatImplementationEvaluationSummary({ mode: null })).toBe('Keine Evaluierung geplant');
  });

  it('labels every evaluation mode', () => {
    expect(getImplementationEvaluationModeLabel('fixed_date')).toBe('Festes Datum');
    expect(getImplementationEvaluationModeLabel('relative_to_vote')).toBe(
      'Relativ zur finalen Abstimmung'
    );
    expect(getImplementationEvaluationModeLabel(null)).toBe('Keine Evaluierung');
  });

  it.each([
    ['scheduled', null, 'In Bearbeitung'],
    ['in_vote', null, 'In Abstimmung'],
    ['approved', 'evaluation_in_vote', 'In Abstimmung'],
    ['rejected', null, 'Abgelehnt'],
    ['withdrawn', null, 'Abgelehnt'],
    ['completed', 'evaluation_scheduled', 'Angenommen und in Umsetzung'],
    ['completed', 'implementation_window', 'Angenommen und in Umsetzung'],
    ['completed', null, 'Angenommen'],
    ['approved', 'awaiting_evaluation', null],
  ] as const)(
    'derives display status from process=%s and implementation=%s',
    (processStatus, implementationStatus, expected) => {
      expect(deriveImplementationDisplayStatus({ processStatus, implementationStatus })).toBe(
        expected
      );
    }
  );

  it('handles missing and insufficient review votes', () => {
    expect(resolveImplementationReviewVoteOutcome(null)).toBeNull();
    expect(resolveImplementationReviewVoteOutcome({ choices: undefined })).toBeNull();
    expect(resolveImplementationReviewVoteOutcome({ choices: [{ id: 'only' }] })).toBeNull();
  });

  it('uses ordered fallback choices, trims labels, and counts only final offline tallies', () => {
    expect(
      resolveImplementationReviewVoteOutcome({
        majority_type: 'absolute',
        choices: [
          { id: 'no', label: '  REJECT ', order_index: null },
          { id: 'yes', label: ' ACCEPT ', order_index: 1 },
        ],
        voters: [{}, {}, {}, {}],
        final_participations: undefined,
        final_decisions: [{ choice_id: 'yes' }, { choice_id: 'unknown' }],
        offline_tallies: [
          { choice_id: 'yes', count: 2, phase: 'final' },
          { choice_id: 'no', count: 99, phase: 'indicative' },
          { choice_id: 'unknown-offline', count: 1, phase: 'final' },
        ],
      })
    ).toBe('yes');

    expect(
      resolveImplementationReviewVoteOutcome({
        majority_type: 'two_thirds',
        choices: [
          { id: 'first', label: null, order_index: 2 },
          { id: 'second', label: undefined, order_index: 3 },
        ],
        voters: undefined,
        final_participations: undefined,
        final_decisions: undefined,
        offline_tallies: [
          { choice_id: 'first', count: 2, phase: 'final' },
          { choice_id: 'second', count: 1, phase: 'final' },
        ],
      })
    ).toBe('yes');
  });

  it('defaults unknown majority types to simple voting', () => {
    expect(
      resolveImplementationReviewVoteOutcome({
        majority_type: 'unsupported',
        choices: [
          { id: 'yes', label: 'yes' },
          { id: 'no', label: 'no' },
        ],
        final_decisions: [{ choice_id: 'no' }],
        offline_tallies: undefined,
      })
    ).toBe('no');
  });

  it('labels yes, no, tie, and absent outcomes', () => {
    expect(getImplementationReviewOutcomeLabel('yes')).toBe('Ja');
    expect(getImplementationReviewOutcomeLabel('no')).toBe('Nein');
    expect(getImplementationReviewOutcomeLabel('tie')).toBe('Stimmengleichstand');
    expect(getImplementationReviewOutcomeLabel(null)).toBeNull();
  });
});
