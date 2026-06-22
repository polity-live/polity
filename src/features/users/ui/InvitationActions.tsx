import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '@/features/groups/logic/groupConflictPreflight';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  ActionSubmissionOverlay,
  useActionSubmission,
  type ActionSubmissionPreview,
} from '@/features/shared/ui/action-submission';
import type { FilterableRecord } from '../hooks/useUserMembershipsFilters';
import { InvitationActionsView } from './InvitationActionsView';

interface InvitationActionsProps {
  item: FilterableRecord;
  onAccept?: (id: string) => unknown | Promise<unknown>;
  onDecline?: (id: string) => void;
  getAcceptPreflightInput?: (
    membership: FilterableRecord
  ) => GroupConflictMembershipPreflight | null | undefined;
}

function getInvitationPreview(item: FilterableRecord): ActionSubmissionPreview {
  const row = item as any;
  const group = row.group;
  const event = row.event;
  const amendment = row.amendment;
  const blog = row.blog;

  if (group) {
    return {
      entityLabel: translateText('pages.user.invitations.preview.labels.group'),
      title: group.name || translateText('pages.user.invitations.preview.fallbackTitles.group'),
      description: translateText('pages.user.invitations.preview.descriptions.group'),
      badges: [translateText('pages.user.invitations.preview.badges.group')],
    };
  }

  if (event) {
    return {
      entityLabel: translateText('pages.user.invitations.preview.labels.event'),
      title: event.title || translateText('pages.user.invitations.preview.fallbackTitles.event'),
      description: translateText('pages.user.invitations.preview.descriptions.event'),
      badges: [translateText('pages.user.invitations.preview.badges.event')],
    };
  }

  if (amendment) {
    return {
      entityLabel: translateText('pages.user.invitations.preview.labels.amendment'),
      title:
        amendment.title || translateText('pages.user.invitations.preview.fallbackTitles.amendment'),
      description: translateText('pages.user.invitations.preview.descriptions.amendment'),
      badges: [translateText('pages.user.invitations.preview.badges.amendment')],
    };
  }

  if (blog) {
    return {
      entityLabel: translateText('pages.user.invitations.preview.labels.blog'),
      title: blog.title || translateText('pages.user.invitations.preview.fallbackTitles.blog'),
      description: translateText('pages.user.invitations.preview.descriptions.blog'),
      badges: [translateText('pages.user.invitations.preview.badges.blog')],
    };
  }

  return {
    entityLabel: translateText('pages.user.invitations.preview.invitationLabel'),
    title: translateText('pages.user.invitations.preview.invitationTitle'),
    description: translateText('pages.user.invitations.preview.invitationDescription'),
  };
}

export function InvitationActions({
  item,
  onAccept,
  onDecline,
  getAcceptPreflightInput,
}: InvitationActionsProps) {
  const actionSubmission = useActionSubmission('accept');
  const preflightInput = getAcceptPreflightInput?.(item) ?? null;
  const { response, blocking } = useGroupConflictPreflight(preflightInput, {
    enabled: Boolean(preflightInput),
  });
  const preview = getInvitationPreview(item);
  const handleAccept = () => {
    if (!onAccept || blocking) return;

    void actionSubmission
      .runActionWithSubmission(async () => onAccept(item.id), {
        onSuccess: actionSubmission.reset,
      })
      .catch(() => undefined);
  };

  return (
    <>
      <InvitationActionsView
        item={item}
        onAccept={handleAccept}
        onDecline={onDecline}
        blocking={blocking}
        acceptDisabled={actionSubmission.isActive}
        response={response}
        labels={{
          accept: translateText('generated.inline.0121_accept_bb54db51'),
          decline: translateText('generated.inline.0122_decline_b59cf9ed'),
          why: translateText('generated.inline.0693_warum_194dad5c'),
          blockedTitle: translateText(
            'generated.inline.1195_warum_ist_diese_annahme_blockiert_1fd1c7d1'
          ),
        }}
      />
      <ActionSubmissionOverlay
        kind="accept"
        status={actionSubmission.status}
        steps={actionSubmission.progressSteps}
        error={actionSubmission.error}
        preview={preview}
        target={{ label: translateText('common.actions.done'), onClick: actionSubmission.reset }}
        onBack={actionSubmission.reset}
        onRetry={() => void actionSubmission.retry()}
      />
    </>
  );
}
