export type FinalVoteAction = 'start' | 'close' | 'cast';
export type FinalVoteKind = 'change_request' | 'closing' | 'merge';

export interface FinalVoteActionChoice {
  label?: string | null;
  semantic_key?: string | null;
  process_branch_id?: string | null;
  processBranchId?: string | null;
  branch_id?: string | null;
  branchId?: string | null;
  order_index?: number | null;
}

export interface FinalVoteActionItem {
  title?: string | null;
  step_kind?: string | null;
  _voteStepKind?: string | null;
  is_closing_vote?: boolean | null;
  display_cr_id?: string | null;
  displayCrId?: string | null;
  cr_id?: string | null;
  crId?: string | null;
  change_request?: {
    title?: string | null;
    display_cr_id?: string | null;
    displayCrId?: string | null;
    cr_id?: string | null;
    crId?: string | null;
  } | null;
  vote?: {
    title?: string | null;
    purpose?: string | null;
    choices?: readonly FinalVoteActionChoice[] | null;
  } | null;
}

export interface FinalVoteActionLabelOptions {
  item?: FinalVoteActionItem | null;
  agendaTitle?: string | null;
  amendmentTitle?: string | null;
  branchLabelsById?:
    | ReadonlyMap<string, string | null | undefined>
    | Record<string, string | null | undefined>
    | null;
  fallbackTarget?: string | null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }

  return null;
}

function isMergeKind(value: string | null | undefined) {
  return value === 'merge_variant';
}

function isClosingKind(value: string | null | undefined) {
  return value === 'closing';
}

export function getFinalVoteKind(item?: FinalVoteActionItem | null): FinalVoteKind {
  const kindSources = [item?._voteStepKind, item?.step_kind, item?.vote?.purpose];

  if (kindSources.some(isMergeKind)) {
    return 'merge';
  }

  if (kindSources.some(isClosingKind) || item?.is_closing_vote) {
    return 'closing';
  }

  return 'change_request';
}

function getBranchLabel(
  branchLabelsById: FinalVoteActionLabelOptions['branchLabelsById'],
  branchId: string | null
) {
  if (!branchId || !branchLabelsById) return null;

  if ('get' in branchLabelsById && typeof branchLabelsById.get === 'function') {
    return text(branchLabelsById.get(branchId));
  }

  return text((branchLabelsById as Record<string, string | null | undefined>)[branchId]);
}

function isAbstainChoice(choice: FinalVoteActionChoice) {
  const semanticKey = text(choice.semantic_key)?.toLowerCase();
  const label = text(choice.label)?.toLowerCase();
  return semanticKey === 'abstain' || label === 'abstain';
}

function getChangeRequestTarget(options: FinalVoteActionLabelOptions) {
  const { item, fallbackTarget } = options;
  const changeRequest = item?.change_request;

  return (
    firstText(
      changeRequest?.display_cr_id,
      changeRequest?.displayCrId,
      item?.display_cr_id,
      item?.displayCrId,
      changeRequest?.cr_id,
      changeRequest?.crId,
      item?.cr_id,
      item?.crId,
      changeRequest?.title,
      item?.title,
      fallbackTarget
    ) ?? 'Step'
  );
}

function getClosingTarget(options: FinalVoteActionLabelOptions) {
  const { item, amendmentTitle, agendaTitle, fallbackTarget } = options;

  return (
    firstText(amendmentTitle, agendaTitle, item?.vote?.title, item?.title, fallbackTarget) ?? 'Step'
  );
}

function getMergeTarget(options: FinalVoteActionLabelOptions) {
  const { item, branchLabelsById, fallbackTarget } = options;
  const branchLabels = [...(item?.vote?.choices ?? [])]
    .filter(choice => !isAbstainChoice(choice))
    .sort((left, right) => {
      const leftOrder =
        typeof left.order_index === 'number' ? left.order_index : Number.MAX_SAFE_INTEGER;
      const rightOrder =
        typeof right.order_index === 'number' ? right.order_index : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .map(choice => {
      const branchId = firstText(
        choice.process_branch_id,
        choice.processBranchId,
        choice.branch_id,
        choice.branchId
      );
      return firstText(choice.label, getBranchLabel(branchLabelsById, branchId));
    })
    .filter((label): label is string => Boolean(label));

  if (branchLabels.length > 0) {
    return branchLabels.join(' VS ');
  }

  return firstText(item?.vote?.title, item?.title, fallbackTarget) ?? 'Step';
}

export function getFinalVoteActionTarget(options: FinalVoteActionLabelOptions) {
  const kind = getFinalVoteKind(options.item);

  if (kind === 'merge') {
    return getMergeTarget(options);
  }

  if (kind === 'closing') {
    return getClosingTarget(options);
  }

  return getChangeRequestTarget(options);
}

export function getFinalVoteActionLabel(
  action: FinalVoteAction,
  options: FinalVoteActionLabelOptions
) {
  const kind = getFinalVoteKind(options.item);
  const target = getFinalVoteActionTarget(options);
  const verb = action === 'start' ? 'Start' : action === 'close' ? 'Close' : 'Cast';

  if (kind === 'merge') {
    return `${verb} final merge vote ${target}`;
  }

  if (kind === 'closing') {
    return `${verb} final closing vote: ${target}`;
  }

  return `${verb} final change request vote: ${target}`;
}

export function getFinalVoteActionLabels(options: FinalVoteActionLabelOptions) {
  return {
    kind: getFinalVoteKind(options.item),
    start: getFinalVoteActionLabel('start', options),
    close: getFinalVoteActionLabel('close', options),
    castFinal: getFinalVoteActionLabel('cast', options),
  };
}
