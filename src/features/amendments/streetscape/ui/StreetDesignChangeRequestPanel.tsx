import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckIcon,
  ChevronDown,
  MessageSquare,
  Pencil,
  Send,
  Vote,
  XIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { getBadgeToneClasses } from '@/features/shared/theme';
import type { EditorCollaborator } from '@/features/editor/types';
import {
  formatStreetDesignChangeRequestIdentifier,
  formatStreetDesignChangeRequestTitle,
  getStreetDesignChangeRequestDiffRows,
  getStreetDesignChangeRequestDiscussionId,
  getStreetDesignChangeRequestTone,
  type StreetDesignChangeRequest,
} from '../logic/streetDesignChangeRequests';
import { getStreetDesignObjectSnapshot } from '../logic/streetDesignChangeRequestDiff';
import { getStreetDesignCostLine } from '../logic/streetDesignCosting';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignObjectVariantLabelKey } from '../logic/streetDesignVariantCatalog';
import { getStreetDesignGeometryRotationDeg } from '../logic/streetDesignPlacement';
import type { StreetDesignObject } from '../types';

type StreetDesignVote = 'accept' | 'reject' | 'abstain';

export interface StreetDesignCommentLike {
  id?: string | null;
  contentRich?: unknown;
  createdAt?: string | number | Date | null;
  discussionId?: string | null;
  userId?: string | null;
  user_id?: string | null;
  isEdited?: boolean | null;
}

export interface StreetDesignDiscussionLike {
  id: string;
  comments?: readonly StreetDesignCommentLike[] | null;
  [key: string]: unknown;
}

interface StreetDesignChangeRequestPanelProps {
  changeRequest: StreetDesignChangeRequest;
  discussions?: readonly StreetDesignDiscussionLike[];
  collaborators?: readonly EditorCollaborator[];
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
  canVote?: boolean;
  canFinalize?: boolean;
  compact?: boolean;
  onClose?: () => void;
  onVote?: (changeRequestId: string, vote: StreetDesignVote) => void | Promise<void>;
  onFinalize?: (changeRequestId: string) => void | Promise<void>;
  onTitleChange?: (changeRequestId: string, title: string) => void | Promise<void>;
  onCommentSubmit?: (changeRequestId: string, text: string) => void | Promise<void>;
}

interface StreetDesignChangeRequestCanvasListProps extends Omit<
  StreetDesignChangeRequestPanelProps,
  'changeRequest' | 'compact' | 'onClose'
> {
  changeRequests: readonly StreetDesignChangeRequest[];
  selectedChangeRequestId: string | null;
  onChangeRequestSelect: (changeRequestId: string | null) => void;
}

export function StreetDesignChangeRequestCanvasList({
  changeRequests,
  selectedChangeRequestId,
  onChangeRequestSelect,
}: StreetDesignChangeRequestCanvasListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-background/95 pointer-events-auto absolute top-4 right-4 z-20 w-[min(18rem,calc(100%-2rem))] overflow-hidden rounded-md border text-sm shadow-xl backdrop-blur">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('features.amendments.streetscape.changeRequests.badge', 'Change requests')}
            </p>
            <h2 className="text-sm font-semibold">
              {t('features.amendments.streetscape.topbar.changeRequestsCount', {
                count: changeRequests.length,
              })}
            </h2>
          </div>
          {selectedChangeRequestId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('features.amendments.streetscape.changeRequests.close', 'Close')}
              onClick={() => onChangeRequestSelect(null)}
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-h-72 overflow-auto p-2">
        {changeRequests.length === 0 ? (
          <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
            {t('features.amendments.streetscape.topbar.noChangeRequests', 'No change requests')}
          </div>
        ) : (
          changeRequests.map(changeRequest => (
            <StreetDesignChangeRequestListItem
              key={changeRequest.id}
              changeRequest={changeRequest}
              selected={selectedChangeRequestId === changeRequest.id}
              onSelect={() => onChangeRequestSelect(changeRequest.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function StreetDesignChangeRequestPanel({
  changeRequest,
  discussions = [],
  collaborators = [],
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  canVote = false,
  canFinalize = false,
  compact = false,
  onClose,
  onVote,
  onFinalize,
  onTitleChange,
  onCommentSubmit,
}: StreetDesignChangeRequestPanelProps) {
  const { t } = useTranslation();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(formatStreetDesignChangeRequestTitle(changeRequest));
  const [commentValue, setCommentValue] = useState('');
  const tone = getStreetDesignChangeRequestTone(changeRequest);
  const identifier = formatStreetDesignChangeRequestIdentifier(changeRequest);
  const author = getChangeRequestAuthor(changeRequest, collaborators);
  const discussion = getDiscussionForChangeRequest(changeRequest, discussions);
  const comments = discussion?.comments ?? [];
  const currentUserVote = getCurrentUserVote(changeRequest, currentUserId);
  const voteCounts = getVoteCounts(changeRequest);
  const totalVotes = voteCounts.accept + voteCounts.reject + voteCounts.abstain;
  const eligibleVoterCount =
    changeRequest.eligible_voter_count ??
    changeRequest.eligibleVoterCount ??
    Math.max(collaborators.length, totalVotes);
  const votedCollaboratorCount =
    changeRequest.voted_collaborator_count ?? changeRequest.votedCollaboratorCount ?? totalVotes;
  const projectedOutcome =
    voteCounts.accept > voteCounts.reject
      ? t('features.amendments.changeRequests.actions.accept', 'Accept')
      : t('features.amendments.changeRequests.actions.reject', 'Reject');
  const propertyRows = useMemo(() => buildPropertyRows(changeRequest, t), [changeRequest, t]);
  const canSubmitComment = Boolean(currentUserId && commentValue.trim());

  const saveTitle = async () => {
    const nextTitle = titleValue.trim();
    setEditingTitle(false);
    if (nextTitle === formatStreetDesignChangeRequestTitle(changeRequest)) return;
    await onTitleChange?.(changeRequest.id, nextTitle);
  };

  const submitComment = async () => {
    const text = commentValue.trim();
    if (!text) return;
    setCommentValue('');
    await onCommentSubmit?.(changeRequest.id, text);
  };

  return (
    <div className={cn('space-y-4 p-4', compact && 'max-h-[min(34rem,80vh)] overflow-auto')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-7">
              <AvatarImage alt={author.name} src={author.avatarUrl ?? undefined} />
              <AvatarFallback>{getInitial(author.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{author.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatRelativeTime(changeRequest.created_at ?? changeRequest.updated_at)}
              </p>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="bg-primary/15 text-primary rounded-md px-2 py-1 font-mono text-xs font-semibold">
                {identifier}
              </span>
              {editingTitle ? (
                <Input
                  value={titleValue}
                  className="h-8 min-w-0 flex-1"
                  onChange={event => setTitleValue(event.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void saveTitle();
                    if (event.key === 'Escape') {
                      setTitleValue(formatStreetDesignChangeRequestTitle(changeRequest));
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold">
                  {formatStreetDesignChangeRequestTitle(changeRequest)}
                </h3>
              )}
              {onTitleChange ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('features.amendments.streetscape.changeRequests.edit', 'Edit')}
                  onClick={() => setEditingTitle(true)}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('features.amendments.streetscape.changeRequests.close', 'Close')}
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('features.amendments.streetscape.changeRequests.type', 'Type')}:
        </span>
        <span className={cn('rounded-md border px-2 py-1 text-sm', getToneBadgeClassName(tone))}>
          {t(`features.amendments.streetscape.changeRequests.tones.${tone}`, tone)}
        </span>
      </div>

      <div className="bg-background/70 rounded-md border p-3 text-sm">
        {votedCollaboratorCount}/{eligibleVoterCount}{' '}
        {t(
          'features.amendments.voteControls.collaboratorsWithVoteRightVoted',
          'collaborators with vote right voted'
        )}
      </div>

      {currentUserVote ? (
        <div className={cn('rounded-md border p-4', getBadgeToneClasses('info'))}>
          <p className="mb-2 text-sm font-semibold">
            {t('plateJs.blockSuggestion.voteRecorded', 'Vote recorded')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t('features.amendments.changeRequests.votes.youVoted', 'You voted to')}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-md px-3 py-1 text-sm font-semibold',
                currentUserVote === 'accept'
                  ? getBadgeToneClasses('success')
                  : currentUserVote === 'reject'
                    ? getBadgeToneClasses('danger')
                    : getBadgeToneClasses('neutral')
              )}
            >
              {getVoteLabel(currentUserVote, t)}
            </span>
          </div>
        </div>
      ) : (
        <div className={cn('rounded-md border p-3', getBadgeToneClasses('info'))}>
          <p className="mb-1 text-sm font-semibold">
            {t('plateJs.blockSuggestion.voteRequired', 'Voting Required')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t(
              'features.amendments.changeRequests.voteRequiredDescription',
              'Cast your vote for this change request.'
            )}
          </p>
        </div>
      )}

      {canVote ? (
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="default"
            presentation="success"
            className={cn(currentUserVote === 'accept' && 'ring-ring ring-2 ring-offset-1')}
            onClick={() => void onVote?.(changeRequest.id, 'accept')}
          >
            <CheckIcon className="mr-2 size-4" />
            {getVoteLabel('accept', t)}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={cn(currentUserVote === 'reject' && 'ring-ring ring-2 ring-offset-1')}
            onClick={() => void onVote?.(changeRequest.id, 'reject')}
          >
            <XIcon className="mr-2 size-4" />
            {getVoteLabel('reject', t)}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(currentUserVote === 'abstain' && 'ring-ring ring-2 ring-offset-1')}
            onClick={() => void onVote?.(changeRequest.id, 'abstain')}
          >
            {getVoteLabel('abstain', t)}
          </Button>
        </div>
      ) : null}

      {canFinalize ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full">
              <CheckCircle2 className="mr-2 size-4" />
              {t(
                'features.amendments.changeRequests.actions.finalizeInternalVote',
                'Interne Abstimmung beenden'
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(
                  'features.amendments.changeRequests.actions.finalizeInternalVoteQuestion',
                  'Interne Abstimmung beenden?'
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  'features.amendments.changeRequests.finalizeResult',
                  {
                    result: projectedOutcome,
                    accept: voteCounts.accept,
                    reject: voteCounts.reject,
                    abstain: voteCounts.abstain,
                  },
                  `Result: ${projectedOutcome}. Accept ${voteCounts.accept}, Reject ${voteCounts.reject}, Abstain ${voteCounts.abstain}.`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.actions.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onFinalize?.(changeRequest.id)}>
                {t(
                  'features.amendments.changeRequests.actions.finalizeInternalVote',
                  'Interne Abstimmung beenden'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <Accordion type="single" collapsible defaultValue="properties">
        <AccordionItem value="properties">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Pencil className="text-muted-foreground size-4" />
              {t('features.amendments.streetscape.changeRequests.diff', 'Changed properties')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {propertyRows.length === 0 ? (
              <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
                {t('features.amendments.streetscape.changeRequests.emptyDiff', 'No changes')}
              </div>
            ) : (
              <div className="space-y-2">
                {propertyRows.map(row => (
                  <div key={row.key} className="bg-background/80 rounded-md border p-3 text-xs">
                    <p className="font-semibold">{row.label}</p>
                    {row.changed ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <ValueCell
                          label={t(
                            'features.amendments.streetscape.changeRequests.before',
                            'Before'
                          )}
                          value={row.before}
                        />
                        <ValueCell
                          label={t('features.amendments.streetscape.changeRequests.after', 'After')}
                          value={row.after}
                        />
                      </div>
                    ) : (
                      <ValueCell label={t('common.value', 'Value')} value={row.after} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Vote className="text-muted-foreground size-4" />
          {t('features.amendments.streetscape.changeRequests.votes', 'Votes')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <VoteCount label={getVoteLabel('accept', t)} value={voteCounts.accept} />
          <VoteCount label={getVoteLabel('reject', t)} value={voteCounts.reject} />
          <VoteCount label={getVoteLabel('abstain', t)} value={voteCounts.abstain} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="text-muted-foreground size-4" />
          {t('features.amendments.streetscape.changeRequests.comments', 'Comments')}
        </div>
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
              {t('features.amendments.streetscape.changeRequests.noComments', 'No comments yet.')}
            </div>
          ) : (
            comments.map((comment, index) => (
              <StreetDesignComment
                key={comment.id ?? `${getCommentUserId(comment)}-${index}`}
                comment={comment}
                collaborators={collaborators}
                currentUserId={currentUserId}
                currentUserDisplayName={currentUserDisplayName}
                currentUserAvatarUrl={currentUserAvatarUrl}
              />
            ))
          )}
        </div>
        <div className="flex items-end gap-2">
          <Avatar className="size-8">
            <AvatarImage
              alt={currentUserDisplayName ?? ''}
              src={currentUserAvatarUrl ?? undefined}
            />
            <AvatarFallback>{getInitial(currentUserDisplayName ?? 'U')}</AvatarFallback>
          </Avatar>
          <Textarea
            value={commentValue}
            placeholder={t('features.amendments.streetscape.changeRequests.reply', 'Reply...')}
            className="min-h-10 flex-1 resize-none"
            onChange={event => setCommentValue(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={t('features.amendments.streetscape.changeRequests.submitComment', 'Send')}
            disabled={!canSubmitComment}
            onClick={() => void submitComment()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}

function StreetDesignChangeRequestListItem({
  changeRequest,
  selected,
  onSelect,
}: {
  changeRequest: StreetDesignChangeRequest;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = getStreetDesignChangeRequestTone(changeRequest);
  const voteCounts = getVoteCounts(changeRequest);
  return (
    <button
      type="button"
      className={cn(
        'hover:bg-muted/40 focus-visible:ring-ring w-full rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
        selected && 'border-primary bg-primary/5'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-1 size-2.5 rounded-full', getToneDotClassName(tone))} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold">
              {formatStreetDesignChangeRequestIdentifier(changeRequest)}
            </span>
            <span className="text-muted-foreground text-[11px]">{changeRequest.change_type}</span>
          </div>
          <p className="truncate text-sm font-semibold">
            {formatStreetDesignChangeRequestTitle(changeRequest)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {voteCounts.accept} / {voteCounts.reject} / {voteCounts.abstain}
          </p>
        </div>
        <ChevronDown className={cn('text-muted-foreground size-4', selected && '-rotate-90')} />
      </div>
    </button>
  );
}

function StreetDesignComment({
  comment,
  collaborators,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
}: {
  comment: StreetDesignCommentLike;
  collaborators: readonly EditorCollaborator[];
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
}) {
  const userId = getCommentUserId(comment);
  const author = getCommentAuthor({
    userId,
    collaborators,
    currentUserId,
    currentUserDisplayName,
    currentUserAvatarUrl,
  });

  return (
    <div className="flex gap-2">
      <Avatar className="size-7">
        <AvatarImage alt={author.name} src={author.avatarUrl ?? undefined} />
        <AvatarFallback>{getInitial(author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{author.name}</p>
          <p className="text-muted-foreground text-xs">{formatRelativeTime(comment.createdAt)}</p>
        </div>
        <p className="text-sm leading-5">{extractPlainText(comment.contentRich)}</p>
      </div>
    </div>
  );
}

function ValueCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

function VoteCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/80 rounded-md border px-3 py-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground text-[11px]">{label}</p>
    </div>
  );
}

function buildPropertyRows(
  changeRequest: StreetDesignChangeRequest,
  t: (key: string, fallback?: string) => string
) {
  const beforeObject = getStreetDesignObjectSnapshot(changeRequest.original_properties);
  const afterObject = getStreetDesignObjectSnapshot(changeRequest.new_properties);
  const objectRows =
    beforeObject || afterObject ? buildObjectInspectorRows(beforeObject, afterObject, t) : [];
  const diffRows = getStreetDesignChangeRequestDiffRows(changeRequest).map(row => ({
    key: `diff:${row.key}`,
    label: row.key,
    before: row.before,
    after: row.after,
    changed: row.before !== row.after,
  }));
  const existingKeys = new Set(objectRows.map(row => row.key));
  return [...objectRows, ...diffRows.filter(row => !existingKeys.has(row.key))];
}

function buildObjectInspectorRows(
  beforeObject: StreetDesignObject | null,
  afterObject: StreetDesignObject | null,
  t: (key: string, fallback?: string) => string
) {
  const object = afterObject ?? beforeObject;
  if (!object) return [];

  const definition = getStreetDesignObjectDefinition(object.type);
  const rows = [
    objectValueRow(
      'object',
      t(getStreetDesignObjectVariantLabelKey(object) ?? definition.labelKey),
      beforeObject,
      afterObject,
      objectLabel
    ),
    objectValueRow(
      'width',
      t('features.amendments.streetscape.inspector.width', 'Width'),
      beforeObject,
      afterObject,
      geometryWidth
    ),
    objectValueRow(
      'length',
      t('features.amendments.streetscape.inspector.length', 'Length'),
      beforeObject,
      afterObject,
      geometryLength
    ),
    objectValueRow(
      'area',
      t('features.amendments.streetscape.inspector.area', 'Area'),
      beforeObject,
      afterObject,
      geometryArea
    ),
    objectValueRow(
      'rotation',
      t('features.amendments.streetscape.inspector.rotation', 'Rotation'),
      beforeObject,
      afterObject,
      geometryRotation
    ),
    ...definition.propertySchema.map(field =>
      objectValueRow(
        `property:${field.key}`,
        t(field.labelKey),
        beforeObject,
        afterObject,
        target => formatValue(target.properties[field.key])
      )
    ),
    objectValueRow(
      'price',
      t('features.amendments.streetscape.inspector.price', 'Price'),
      beforeObject,
      afterObject,
      objectUnitCost
    ),
    objectValueRow(
      'total',
      t('features.amendments.streetscape.inspector.total', 'Total'),
      beforeObject,
      afterObject,
      objectTotalCost
    ),
    objectValueRow(
      'suggestedPrice',
      t('features.amendments.streetscape.inspector.suggestedCostShort', 'Suggested Price'),
      beforeObject,
      afterObject,
      objectSuggestedCost
    ),
  ];

  return rows.filter(row => row.before !== '-' || row.after !== '-');
}

function objectValueRow(
  key: string,
  label: string,
  beforeObject: StreetDesignObject | null,
  afterObject: StreetDesignObject | null,
  formatter: (object: StreetDesignObject) => string
) {
  const before = beforeObject ? formatter(beforeObject) : '-';
  const after = afterObject ? formatter(afterObject) : '-';
  return {
    key,
    label,
    before,
    after,
    changed: before !== after,
  };
}

function objectLabel(object: StreetDesignObject) {
  return object.id.slice(0, 8);
}

function geometryWidth(object: StreetDesignObject) {
  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    return formatNumber(object.geometry.width);
  }
  return '-';
}

function geometryLength(object: StreetDesignObject) {
  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    return formatNumber(object.geometry.length);
  }
  return '-';
}

function geometryArea(object: StreetDesignObject) {
  if (
    object.geometry.kind === 'corridor' ||
    object.geometry.kind === 'path_corridor' ||
    object.geometry.kind === 'polygon'
  ) {
    return formatNumber(object.geometry.area);
  }
  return '-';
}

function geometryRotation(object: StreetDesignObject) {
  return formatNumber(getStreetDesignGeometryRotationDeg(object.geometry));
}

function objectUnitCost(object: StreetDesignObject) {
  return formatMinorCurrency(object.cost.customUnitCostMinor ?? object.cost.suggestedUnitCostMinor);
}

function objectTotalCost(object: StreetDesignObject) {
  return formatMinorCurrency(getStreetDesignCostLine(object).totalCostMinor);
}

function objectSuggestedCost(object: StreetDesignObject) {
  return formatMinorCurrency(object.cost.suggestedUnitCostMinor);
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(1))).replace('.', ',') : '-';
}

function formatValue(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function getVoteCounts(changeRequest: StreetDesignChangeRequest) {
  return {
    accept: changeRequest.votes_for ?? 0,
    reject: changeRequest.votes_against ?? 0,
    abstain: changeRequest.votes_abstain ?? 0,
  };
}

function getCurrentUserVote(
  changeRequest: StreetDesignChangeRequest,
  currentUserId?: string | null
): StreetDesignVote | null {
  if (!currentUserId) return null;
  const vote = changeRequest.votes?.find(
    entry => (entry.user_id ?? entry.userId) === currentUserId
  );
  const value = vote?.vote ?? vote?.vote_choice ?? vote?.choice;
  return value === 'accept' || value === 'reject' || value === 'abstain' ? value : null;
}

function getVoteLabel(vote: StreetDesignVote, t: (key: string, fallback?: string) => string) {
  if (vote === 'accept') return t('features.amendments.changeRequests.actions.accept', 'Accept');
  if (vote === 'reject') return t('features.amendments.changeRequests.actions.reject', 'Reject');
  return t('features.amendments.changeRequests.actions.abstain', 'Abstain');
}

function getDiscussionForChangeRequest(
  changeRequest: StreetDesignChangeRequest,
  discussions: readonly StreetDesignDiscussionLike[]
) {
  const discussionId = getStreetDesignChangeRequestDiscussionId(changeRequest);
  return discussions.find(
    discussion =>
      discussion.id === discussionId ||
      discussion.changeRequestEntityId === changeRequest.id ||
      discussion.crId === formatStreetDesignChangeRequestIdentifier(changeRequest)
  );
}

function getChangeRequestAuthor(
  changeRequest: StreetDesignChangeRequest,
  collaborators: readonly EditorCollaborator[]
) {
  const user = changeRequest.user;
  const rawName =
    user?.name ??
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ??
    user?.email ??
    null;
  const collaborator = collaborators.find(
    item => item.user.id === (changeRequest.user_id ?? changeRequest.userId ?? user?.id)
  );
  return {
    name: rawName || collaborator?.user.name || 'Change request',
    avatarUrl: user?.avatar ?? user?.avatarUrl ?? collaborator?.user.avatarUrl ?? null,
  };
}

function getCommentAuthor(args: {
  userId: string | null;
  collaborators: readonly EditorCollaborator[];
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
}) {
  if (args.userId && args.userId === args.currentUserId) {
    return {
      name: args.currentUserDisplayName ?? 'You',
      avatarUrl: args.currentUserAvatarUrl ?? null,
    };
  }
  const collaborator = args.collaborators.find(item => item.user.id === args.userId);
  return {
    name: collaborator?.user.name ?? 'Comment',
    avatarUrl: collaborator?.user.avatarUrl ?? null,
  };
}

function getCommentUserId(comment: StreetDesignCommentLike) {
  return comment.userId ?? comment.user_id ?? null;
}

function extractPlainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .map(node => extractNodeText(node))
    .join('\n')
    .trim();
}

function extractNodeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as { text?: unknown; children?: unknown };
  if (typeof record.text === 'string') return record.text;
  if (Array.isArray(record.children)) return record.children.map(extractNodeText).join('');
  return '';
}

function formatRelativeTime(value: string | number | Date | null | undefined) {
  if (!value) return '0m';
  const date = value instanceof Date ? value : new Date(value);
  const elapsedMs = Date.now() - date.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '0m';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getInitial(name: string | null | undefined) {
  return (name?.trim()[0] ?? '?').toUpperCase();
}

function getToneDotClassName(tone: string) {
  if (tone === 'add') return 'bg-[var(--badge-success-border)]';
  if (tone === 'remove') return 'bg-[var(--badge-danger-border)]';
  if (tone === 'update') return 'bg-[var(--badge-info-border)]';
  return 'bg-muted-foreground/50';
}

function getToneBadgeClassName(tone: string) {
  if (tone === 'add') return getBadgeToneClasses('success');
  if (tone === 'remove') return getBadgeToneClasses('danger');
  if (tone === 'update') return getBadgeToneClasses('info');
  return getBadgeToneClasses('neutral');
}
