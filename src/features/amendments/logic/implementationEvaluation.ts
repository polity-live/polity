import { computeVoteResult, type MajorityType } from '@/features/votes/logic/computeVoteResult';
import { parseLocalDateInput } from '@/features/shared/logic/localDateTime';

export type AmendmentProcessStatus =
  | 'pending_event'
  | 'scheduled'
  | 'in_vote'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'withdrawn'
  | 'completed'
  | null
  | undefined;

export type ImplementationEvaluationStatus =
  | 'awaiting_evaluation'
  | 'evaluation_scheduled'
  | 'evaluation_in_vote'
  | 'implementation_window'
  | 'implemented'
  | 'implementation_failed'
  | 'withdrawn'
  | null
  | undefined;

export type ImplementationEvaluationMode =
  'none' | 'fixed_date' | 'relative_to_vote' | null | undefined;

interface ImplementationReviewVoteLike {
  majority_type?: string | null;
  choices?:
    | readonly {
        id: string;
        label?: string | null;
        order_index?: number | null;
      }[]
    | null;
  offline_tallies?:
    | readonly {
        choice_id: string;
        count: number;
        phase?: string | null;
      }[]
    | null;
  voters?: readonly unknown[] | null;
  final_participations?: readonly unknown[] | null;
  final_decisions?:
    | readonly {
        choice_id: string;
      }[]
    | null;
}

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

function normalizeDateInput(value: number | string) {
  if (typeof value === 'number') {
    return new Date(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseLocalDateInput(value) ?? new Date(Number.NaN);
  }

  return new Date(value);
}

function normalizeChoiceLabel(label?: string | null) {
  return label?.trim().toLowerCase() ?? null;
}

function isYesChoice(label?: string | null) {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'yes' || normalized === 'accept';
}

function isNoChoice(label?: string | null) {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'no' || normalized === 'reject';
}

export function normalizeImplementationEvaluationMode(
  mode?: string | null
): ImplementationEvaluationMode {
  if (mode === 'none' || mode === 'fixed_date' || mode === 'relative_to_vote') {
    return mode;
  }

  return null;
}

export function normalizeImplementationEvaluationStatus(
  status?: string | null
): ImplementationEvaluationStatus {
  if (
    status === 'awaiting_evaluation' ||
    status === 'evaluation_scheduled' ||
    status === 'evaluation_in_vote' ||
    status === 'implementation_window' ||
    status === 'implemented' ||
    status === 'implementation_failed' ||
    status === 'withdrawn'
  ) {
    return status;
  }

  return null;
}

export function normalizeAmendmentProcessStatus(status?: string | null): AmendmentProcessStatus {
  if (
    status === 'pending_event' ||
    status === 'scheduled' ||
    status === 'in_vote' ||
    status === 'approved' ||
    status === 'rejected' ||
    status === 'merged' ||
    status === 'withdrawn' ||
    status === 'completed'
  ) {
    return status;
  }

  return null;
}

export function formatImplementationEvaluationDate(
  value: number | string | null | undefined,
  locale = useLanguageStore.getState().language === 'de' ? 'de-DE' : 'en-US',
  options?: Intl.DateTimeFormatOptions
) {
  if (value == null || value === '') {
    return null;
  }

  const date = normalizeDateInput(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(locale, options);
}

export function formatImplementationEvaluationOffset(args: {
  months?: number | null;
  years?: number | null;
}) {
  const years = Math.max(0, args.years ?? 0);
  const months = Math.max(0, args.months ?? 0);
  const parts: string[] = [];

  if (years > 0) {
    parts.push(translate('features.amendments.implementationEvaluation.year', { count: years }));
  }

  if (months > 0 || parts.length === 0) {
    parts.push(translate('features.amendments.implementationEvaluation.month', { count: months }));
  }

  return parts.join(', ');
}

export function formatImplementationEvaluationSummary(args: {
  mode: ImplementationEvaluationMode;
  fixedDate?: number | string | null;
  offsetMonths?: number | null;
  offsetYears?: number | null;
  locale?: string;
}) {
  if (args.mode === 'fixed_date') {
    return (
      formatImplementationEvaluationDate(args.fixedDate, args.locale) ??
      translate('features.amendments.implementationEvaluation.noDate')
    );
  }

  if (args.mode === 'relative_to_vote') {
    return translate('features.amendments.implementationEvaluation.afterAdoption', {
      offset: formatImplementationEvaluationOffset({
        months: args.offsetMonths,
        years: args.offsetYears,
      }),
    });
  }

  return translate('features.amendments.implementationEvaluation.noEvaluationPlanned');
}

export function getImplementationEvaluationModeLabel(mode: ImplementationEvaluationMode) {
  if (mode === 'fixed_date') {
    return translate('features.amendments.implementationEvaluation.fixedDate');
  }

  if (mode === 'relative_to_vote') {
    return translate('features.amendments.implementationEvaluation.relativeToFinalVote');
  }

  return translate('features.amendments.implementationEvaluation.noEvaluation');
}

export function deriveImplementationDisplayStatus(args: {
  processStatus: AmendmentProcessStatus;
  implementationStatus: ImplementationEvaluationStatus;
}) {
  if (args.processStatus === 'pending_event' || args.processStatus === 'scheduled') {
    return translate('features.amendments.implementationEvaluation.statuses.inProgress');
  }

  if (args.processStatus === 'in_vote' || args.implementationStatus === 'evaluation_in_vote') {
    return translate('features.amendments.implementationEvaluation.statuses.inVote');
  }

  if (args.processStatus === 'rejected' || args.processStatus === 'withdrawn') {
    return translate('features.amendments.implementationEvaluation.statuses.rejected');
  }

  if (args.implementationStatus === 'implemented') {
    return translate('features.amendments.implementationEvaluation.statuses.implemented');
  }

  if (args.implementationStatus === 'implementation_failed') {
    return translate('features.amendments.implementationEvaluation.statuses.implementationFailed');
  }

  if (
    args.processStatus === 'completed' &&
    (args.implementationStatus === 'awaiting_evaluation' ||
      args.implementationStatus === 'evaluation_scheduled' ||
      args.implementationStatus === 'implementation_window')
  ) {
    return translate(
      'features.amendments.implementationEvaluation.statuses.adoptedAndImplementing'
    );
  }

  if (args.processStatus === 'completed') {
    return translate('features.amendments.implementationEvaluation.statuses.adopted');
  }

  return null;
}

export function resolveImplementationReviewVoteOutcome(
  vote: ImplementationReviewVoteLike | null | undefined
) {
  if (!vote) {
    return null;
  }

  const sortedChoices = [...(vote.choices ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const yesChoice =
    sortedChoices.find(choice => isYesChoice(choice.label)) ?? sortedChoices[0] ?? null;
  const noChoice =
    sortedChoices.find(choice => isNoChoice(choice.label)) ?? sortedChoices[1] ?? null;

  if (!yesChoice || !noChoice) {
    return null;
  }

  const tallyByChoiceId = new Map<string, number>();

  for (const choice of sortedChoices) {
    tallyByChoiceId.set(choice.id, 0);
  }

  for (const decision of vote.final_decisions ?? []) {
    tallyByChoiceId.set(decision.choice_id, (tallyByChoiceId.get(decision.choice_id) ?? 0) + 1);
  }

  for (const tally of vote.offline_tallies ?? []) {
    if (tally.phase !== 'final') {
      continue;
    }

    tallyByChoiceId.set(tally.choice_id, (tallyByChoiceId.get(tally.choice_id) ?? 0) + tally.count);
  }

  const yesCount = tallyByChoiceId.get(yesChoice.id) ?? 0;
  const noCount = tallyByChoiceId.get(noChoice.id) ?? 0;
  const totalEligible = Math.max(
    vote.voters?.length ?? 0,
    (vote.final_participations?.length ?? 0) +
      (vote.offline_tallies ?? [])
        .filter(tally => tally.phase === 'final')
        .reduce((sum, tally) => sum + tally.count, 0)
  );
  const result = computeVoteResult(
    yesCount,
    noCount,
    totalEligible,
    normalizeMajorityType(vote.majority_type)
  );

  if (result === 'passed') {
    return 'yes';
  }

  if (result === 'rejected') {
    return 'no';
  }

  return 'tie';
}

export function getImplementationReviewOutcomeLabel(
  outcome: ReturnType<typeof resolveImplementationReviewVoteOutcome>
) {
  if (outcome === 'yes') {
    return translate('features.amendments.implementationEvaluation.outcomes.yes');
  }

  if (outcome === 'no') {
    return translate('features.amendments.implementationEvaluation.outcomes.no');
  }

  if (outcome === 'tie') {
    return translate('features.amendments.implementationEvaluation.outcomes.tie');
  }

  return null;
}
import { translate } from '@/features/shared/hooks/use-translation';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
