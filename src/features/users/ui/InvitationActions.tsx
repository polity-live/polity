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
      entityLabel: 'Group',
      title: group.name || 'Group',
      description: 'Die Gruppenrolle wird aktiviert.',
      badges: ['Mitgliedschaft'],
    };
  }

  if (event) {
    return {
      entityLabel: 'Event',
      title: event.title || 'Event',
      description: 'Deine Teilnahme wird bestätigt.',
      badges: ['Teilnahme'],
    };
  }

  if (amendment) {
    return {
      entityLabel: 'Amendment',
      title: amendment.title || 'Amendment',
      description: 'Deine Mitarbeit wird aktiviert.',
      badges: ['Collaborator'],
    };
  }

  if (blog) {
    return {
      entityLabel: 'Blog',
      title: blog.title || 'Blog',
      description: 'Dein Schreibzugang wird aktiviert.',
      badges: ['Writer'],
    };
  }

  return {
    entityLabel: 'Einladung',
    title: 'Einladung annehmen',
    description: 'Die Einladung wird geprüft und bestätigt.',
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
        target={{ label: translateText('common.done', 'Fertig'), onClick: actionSubmission.reset }}
        onBack={actionSubmission.reset}
        onRetry={() => void actionSubmission.retry()}
      />
    </>
  );
}
