export const AGENDA_VOTE_STEP_KIND = {
  changeRequest: 'change_request',
  closing: 'closing',
  mergeVariant: 'merge_variant',
} as const;

export type AgendaVoteStepKind = (typeof AGENDA_VOTE_STEP_KIND)[keyof typeof AGENDA_VOTE_STEP_KIND];

export function isClosingVoteTimelineItem(
  item:
    | {
        is_closing_vote?: boolean | null;
        step_kind?: string | null;
        _voteStepKind?: string | null;
      }
    | null
    | undefined
) {
  return Boolean(
    item?.is_closing_vote ||
    item?.step_kind === AGENDA_VOTE_STEP_KIND.closing ||
    item?._voteStepKind === AGENDA_VOTE_STEP_KIND.closing
  );
}
