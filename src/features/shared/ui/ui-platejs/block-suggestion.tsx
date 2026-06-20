import * as React from 'react';

import type { TResolvedSuggestion } from '@platejs/suggestion';

import {
  acceptSuggestion,
  getSuggestionKey,
  keyId2SuggestionId,
  rejectSuggestion,
} from '@platejs/suggestion';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { CheckCircle2, CheckIcon, Clock, XIcon, Pencil, Check, X } from 'lucide-react';
import {
  type NodeEntry,
  type Path,
  type TElement,
  type TSuggestionElement,
  type TSuggestionText,
  ElementApi,
  KEYS,
  PathApi,
  TextApi,
} from 'platejs';
import { useEditorPlugin, usePluginOption } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
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
} from '@/features/shared/ui/ui/alert-dialog.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { getBadgeToneClasses } from '@/features/shared/theme';
import {
  type TDiscussion,
  discussionPlugin,
} from '@/features/shared/ui/kit-platejs/discussion-kit.tsx';
import { suggestionPlugin } from '@/features/shared/ui/kit-platejs/suggestion-kit.tsx';
import { useSuggestionCallbacks } from '@/features/shared/ui/kit-platejs/suggestion-callbacks-context.tsx';
import { useModeContext } from '@/features/shared/ui/kit-platejs/mode-context.tsx';

import { type TComment, Comment, CommentCreateForm, formatCommentDate } from './comment.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// Import VoteControls interface to pass the required props
export interface BlockSuggestionVoteProps {
  changeRequestId: string;
  currentUserId: string;
  votes: {
    id: string;
    vote: string;
    createdAt: number;
    voter: {
      id: string;
      user?: {
        name?: string;
        avatar?: string;
      };
    };
  }[];
  collaborators: {
    id: string;
    user: {
      id: string;
      user?: {
        name?: string;
        avatar?: string;
      };
    };
  }[];
  status: string;
  amendmentId: string;
  documentId: string;
  suggestionData?: {
    crId: string;
    description: string;
    proposedChange: string;
    justification: string;
    userId: string;
    createdAt: number;
  };
  onVoteComplete?: () => void;
}

export interface ResolvedSuggestion extends TResolvedSuggestion {
  comments: TComment[];
  title?: string;
  crId?: string; // Format: CR-x (e.g., CR-1, CR-2, etc.)
  changeRequestEntityId?: string;
  votes?: {
    id: string;
    vote: string;
    voterId: string;
  }[];
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  votingDeadline?: number | null;
  closeTrigger?: string | null;
  eligibleVoterCount?: number;
  votedCollaboratorCount?: number;
  resolutionMethod?: string | null;
  visibilityScope?: string | null;
  resolvedInMode?: string | null;
  votingStatus?: string | null;
}

const BLOCK_SUGGESTION = '__block__';

const useTypeTextMap = () => {
  const { t } = useTranslation();

  const TYPE_TEXT_MAP: Record<string, (node?: TElement) => string> = {
    [KEYS.audio]: () => t('plateJs.toolbar.audio'),
    [KEYS.blockquote]: () => t('plateJs.quote'),
    [KEYS.callout]: () => t('plateJs.layout.callout'),
    [KEYS.codeBlock]: () => t('plateJs.code'),
    [KEYS.column]: () => t('plateJs.layout.column'),
    [KEYS.equation]: () => t('plateJs.equation.newEquation'),
    [KEYS.file]: () => t('plateJs.toolbar.file'),
    [KEYS.h1]: () => t('plateJs.headings.heading1'),
    [KEYS.h2]: () => t('plateJs.headings.heading2'),
    [KEYS.h3]: () => t('plateJs.headings.heading3'),
    [KEYS.h4]: () => t('plateJs.headings.heading4'),
    [KEYS.h5]: () => t('plateJs.headings.heading5'),
    [KEYS.h6]: () => t('plateJs.headings.heading6'),
    [KEYS.hr]: () => t('plateJs.toolbar.divider'),
    [KEYS.img]: () => t('plateJs.toolbar.image'),
    [KEYS.mediaEmbed]: () => t('plateJs.media.embed'),
    [KEYS.p]: node => {
      if (node?.[KEYS.listType] === KEYS.listTodo) return t('plateJs.lists.todo');
      if (node?.[KEYS.listType] === KEYS.ol) return t('plateJs.lists.numbered');
      if (node?.[KEYS.listType] === KEYS.ul) return t('plateJs.lists.bulleted');

      return t('plateJs.text');
    },
    [KEYS.table]: () => t('plateJs.toolbar.tableButton'),
    [KEYS.toc]: () => t('plateJs.toolbar.tableOfContents.title'),
    [KEYS.toggle]: () => t('plateJs.lists.toggle'),
    [KEYS.video]: () => t('plateJs.toolbar.video'),
  };

  return TYPE_TEXT_MAP;
};

export function BlockSuggestion({ element }: { element: TSuggestionElement }) {
  const suggestionData = element.suggestion;

  if (suggestionData?.isLineBreak) return null;

  const isRemove = suggestionData?.type === 'remove';

  return (
    <div
      className={cn(
        'border-ring pointer-events-none absolute inset-0 z-1 border-2 transition-opacity',
        isRemove && 'border-[var(--badge-neutral-border)]'
      )}
      contentEditable={false}
    />
  );
}

/**
 * Wrapper around BlockSuggestion that filters by selected CR.
 * Used in `belowRootNodes` render where hooks are available.
 */
export function FilteredBlockSuggestion({ element }: { element: TSuggestionElement }) {
  const { selectedCrIds } = useModeContext();
  const discussions = usePluginOption(discussionPlugin, 'discussions');

  const suggestionId = element.suggestion?.id;
  const blockCrId = discussions?.find(
    (d: { id: string; crId?: string }) => d.id === suggestionId
  )?.crId;
  const isFilteredOut = selectedCrIds != null && blockCrId != null && !selectedCrIds.has(blockCrId);

  if (isFilteredOut) return null;

  return <BlockSuggestion element={element} />;
}

export function BlockSuggestionCard({
  idx,
  isLast,
  suggestion,
}: {
  idx: number;
  isLast: boolean;
  suggestion: ResolvedSuggestion;
}) {
  const { t } = useTranslation();
  const { api, editor } = useEditorPlugin(SuggestionPlugin);
  const {
    onSuggestionAccepted,
    onSuggestionDeclined,
    onFinalizeInternalVote,
    onVoteAccept,
    onVoteReject,
    onVoteAbstain,
  } = useSuggestionCallbacks();
  const { currentMode, isOwnerOrCollaborator } = useModeContext(); // Get current editing mode
  // documentId is not used, removed to fix eslint error
  const userInfo = usePluginOption(discussionPlugin, 'user', suggestion.userId);
  const currentUserId = usePluginOption(discussionPlugin, 'currentUserId');

  // Check if current user has already voted
  const currentUserVote = suggestion.votes?.find(
    (v: { voterId?: string }) => v.voterId === currentUserId
  );
  const hasVoted = !!currentUserVote;
  const acceptVotes =
    suggestion.votesFor ?? suggestion.votes?.filter(vote => vote.vote === 'accept').length ?? 0;
  const rejectVotes =
    suggestion.votesAgainst ?? suggestion.votes?.filter(vote => vote.vote === 'reject').length ?? 0;
  const abstainVotes =
    suggestion.votesAbstain ??
    suggestion.votes?.filter(vote => vote.vote === 'abstain').length ??
    0;
  const totalVotes = acceptVotes + rejectVotes + abstainVotes;
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const remainingMs =
    typeof suggestion.votingDeadline === 'number' ? suggestion.votingDeadline - nowMs : null;
  const remainingMinutes =
    remainingMs !== null && remainingMs > 0 ? Math.ceil(remainingMs / 60_000) : 0;
  const canFinalizeInternalVote =
    currentMode === 'vote_internal' &&
    isOwnerOrCollaborator &&
    suggestion.votingStatus !== 'completed' &&
    Boolean(suggestion.changeRequestEntityId) &&
    Boolean(onFinalizeInternalVote);
  const canVoteOnSuggestion = Boolean(onVoteAccept && onVoteReject && onVoteAbstain);
  const projectedOutcome = acceptVotes > rejectVotes ? 'Accepted' : 'Rejected';

  React.useEffect(() => {
    if (currentMode !== 'vote_internal' || typeof suggestion.votingDeadline !== 'number') return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [currentMode, suggestion.votingDeadline]);

  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleValue, setTitleValue] = React.useState(suggestion.title || '');

  // Sync titleValue with suggestion.title when it changes
  React.useEffect(() => {
    setTitleValue(suggestion.title || '');
  }, [suggestion.title]);

  const handleSaveTitle = () => {
    // Update the suggestion title in the discussions state (so it gets saved to DB)
    // Important: The discussion ID is stored in keyId, not suggestionId!
    const discussionId = suggestion.keyId.replace('suggestion_', '');

    const currentDiscussions = editor.getOption(discussionPlugin, 'discussions') || [];

    // Check if discussion exists
    const existingDiscussion = currentDiscussions.find((d: TDiscussion) => d.id === discussionId);

    if (existingDiscussion) {
      // Update existing discussion
      const updatedDiscussions = currentDiscussions.map((d: TDiscussion) => {
        if (d.id === discussionId) {
          return { ...d, title: titleValue };
        }
        return d;
      });
      editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
    } else {
      // Create new discussion if it doesn't exist (for suggestions without comments yet)
      const newDiscussion: TDiscussion = {
        id: discussionId,
        comments: [],
        createdAt: suggestion.createdAt,
        isResolved: false,
        userId: suggestion.userId,
        title: titleValue,
      };
      editor.setOption(discussionPlugin, 'discussions', [...currentDiscussions, newDiscussion]);
    }

    setEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setTitleValue(suggestion.title || '');
    setEditingTitle(false);
  };

  const accept = (suggestion: ResolvedSuggestion) => {
    api.suggestion.withoutSuggestions(() => {
      acceptSuggestion(editor, suggestion);
    });

    // Call the callback if provided
    if (onSuggestionAccepted) {
      onSuggestionAccepted(suggestion);
    }
  };

  const reject = (suggestion: ResolvedSuggestion) => {
    api.suggestion.withoutSuggestions(() => {
      rejectSuggestion(editor, suggestion);
    });

    // Call the callback if provided
    if (onSuggestionDeclined) {
      onSuggestionDeclined(suggestion);
    }
  };

  const [hovering, setHovering] = React.useState(false);

  const suggestionText2Array = (text: string) => {
    if (text === BLOCK_SUGGESTION) return [t('plateJs.blockSuggestion.lineBreaks')];

    return text.split(BLOCK_SUGGESTION).filter(Boolean);
  };

  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div
      key={`${suggestion.suggestionId}-${idx}`}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex flex-col p-4">
        <div className="relative flex items-center">
          {/* Replace to your own backend or refer to potion */}
          <Avatar className="size-5">
            <AvatarImage alt={userInfo?.name} src={userInfo?.avatarUrl} />
            <AvatarFallback>{userInfo?.name?.[0]}</AvatarFallback>
          </Avatar>
          <h4 className="mx-2 text-sm leading-none font-semibold">{userInfo?.name}</h4>
          <div className="text-muted-foreground/80 text-xs leading-none">
            <span className="mr-1">{formatCommentDate(new Date(suggestion.createdAt))}</span>
          </div>
        </div>

        {/* Suggestion Title */}
        <div className="mt-2 mb-3 flex items-center gap-2">
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                placeholder={translateText('generated.inline.1140_enter_suggestion_title_cb611d14')}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSaveTitle();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveTitle}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCancelEdit}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-2 rounded-md border bg-[var(--surface)] px-3 py-2">
              {/* Display suggestion ID if available */}
              {suggestion.crId && (
                <span
                  className={cn(
                    'rounded px-2 py-1 font-mono text-xs',
                    getBadgeToneClasses('accent')
                  )}
                >
                  {suggestion.crId}
                </span>
              )}
              <span className="text-sm font-semibold">
                {suggestion.title ||
                  translateText('generated.inline.0142_untitled_suggestion_5d70b979')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 w-6 p-0"
                onClick={() => setEditingTitle(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="relative mt-1 mb-4 pl-[32px]">
          <div className="flex flex-col gap-2">
            {suggestion.type === 'remove' && suggestion.text && (
              <React.Fragment>
                {suggestionText2Array(suggestion.text).map((text, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {t('plateJs.blockSuggestion.delete')}
                    </span>

                    <span key={index} className="text-sm">
                      {text}
                    </span>
                  </div>
                ))}
              </React.Fragment>
            )}

            {suggestion.type === 'insert' && suggestion.newText && (
              <React.Fragment>
                {suggestionText2Array(suggestion.newText).map((text, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {t('plateJs.blockSuggestion.add')}
                    </span>

                    <span key={index} className="text-sm">
                      {text || t('plateJs.blockSuggestion.lineBreaks')}
                    </span>
                  </div>
                ))}
              </React.Fragment>
            )}

            {suggestion.type === 'replace' && suggestion.newText && suggestion.text && (
              <div className="flex flex-col gap-2">
                {suggestionText2Array(suggestion.newText).map((text, index) => (
                  <React.Fragment key={index}>
                    <div key={index} className="flex items-start gap-2 text-[var(--badge-info-fg)]">
                      <span className="text-sm">{t('plateJs.blockSuggestion.with')}</span>
                      <span className="text-sm">
                        {text || t('plateJs.blockSuggestion.lineBreaks')}
                      </span>
                    </div>
                  </React.Fragment>
                ))}

                {suggestionText2Array(suggestion.text).map((text, index) => (
                  <React.Fragment key={index}>
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground text-sm">
                        {index === 0
                          ? t('plateJs.blockSuggestion.replace')
                          : t('plateJs.blockSuggestion.delete')}
                      </span>
                      <span className="text-sm">
                        {text || t('plateJs.blockSuggestion.lineBreaks')}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}

            {suggestion.type === 'update' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {Object.keys(suggestion.properties).map(key => (
                    <span key={key}>
                      {t('plateJs.blockSuggestion.un')}
                      {key}
                    </span>
                  ))}

                  {Object.keys(suggestion.newProperties).map(key => (
                    <span key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  ))}
                </span>
                <span className="text-sm">{suggestion.newText}</span>
              </div>
            )}
          </div>
        </div>

        {suggestion.comments.map((comment, index) => (
          <Comment
            key={comment.id ?? index}
            comment={comment}
            discussionLength={suggestion.comments.length}
            documentContent="__suggestion__"
            editingId={editingId}
            index={index}
            setEditingId={setEditingId}
          />
        ))}

        {hovering &&
          currentMode === 'suggest_internal' &&
          onSuggestionAccepted &&
          onSuggestionDeclined && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="ghost"
                className="text-muted-foreground size-6 p-1"
                onClick={() => accept(suggestion)}
              >
                <CheckIcon className="size-4" />
              </Button>

              <Button
                variant="ghost"
                className="text-muted-foreground size-6 p-1"
                onClick={() => reject(suggestion)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )}

        {(currentMode === 'vote_internal' || currentMode === 'vote_event') && (
          <div className="mt-4 space-y-2">
            {currentMode === 'vote_internal' && (
              <div className="bg-background/70 rounded-md border p-3 text-xs">
                {suggestion.closeTrigger === 'after_minutes' && suggestion.votingDeadline ? (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {remainingMs !== null && remainingMs > 0
                        ? translateText(
                            'features.amendments.voteControls.closesInMinutes',
                            { minutes: remainingMinutes },
                            `Closes in ${remainingMinutes} min`
                          )
                        : translateText(
                            'features.amendments.voteControls.deadlineExpired',
                            'Deadline expired'
                          )}
                    </span>
                  </div>
                ) : (
                  <span>
                    {translateText(
                      'features.amendments.voteControls.collaboratorsVoted',
                      {
                        voted: suggestion.votedCollaboratorCount ?? totalVotes,
                        total: suggestion.eligibleVoterCount ?? totalVotes,
                      },
                      `${suggestion.votedCollaboratorCount ?? totalVotes}/${
                        suggestion.eligibleVoterCount ?? totalVotes
                      } collaborators voted`
                    )}
                  </span>
                )}
              </div>
            )}
            {hasVoted ? (
              <div className={cn('rounded-md border p-4', getBadgeToneClasses('info'))}>
                <p className="mb-2 text-sm font-semibold">
                  {t('plateJs.blockSuggestion.voteRecorded')}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    {translateText('generated.inline.1141_you_voted_to_0cd82e7e')}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-semibold ${
                      currentUserVote?.vote === 'accept'
                        ? getBadgeToneClasses('success')
                        : currentUserVote?.vote === 'reject'
                          ? getBadgeToneClasses('danger')
                          : getBadgeToneClasses('neutral')
                    }`}
                  >
                    {currentUserVote?.vote === 'accept' && (
                      <>
                        <CheckIcon className="mr-1 h-4 w-4" />
                        {translateText('generated.inline.0121_accept_bb54db51')}
                      </>
                    )}
                    {currentUserVote?.vote === 'reject' && (
                      <>
                        <XIcon className="mr-1 h-4 w-4" />
                        {translateText('generated.inline.1142_reject_2b03b592')}
                      </>
                    )}
                    {currentUserVote?.vote === 'abstain' && 'Abstain'}
                  </span>
                </div>
                {totalVotes > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-background/70 rounded-md border p-2">
                      <div className="text-muted-foreground">
                        {translateText('generated.inline.0121_accept_bb54db51')}
                      </div>
                      <div className="text-sm font-semibold">{acceptVotes}</div>
                    </div>
                    <div className="bg-background/70 rounded-md border p-2">
                      <div className="text-muted-foreground">
                        {translateText('generated.inline.1142_reject_2b03b592')}
                      </div>
                      <div className="text-sm font-semibold">{rejectVotes}</div>
                    </div>
                    <div className="bg-background/70 rounded-md border p-2">
                      <div className="text-muted-foreground">
                        {translateText('generated.inline.1144_abstain_bc39d849')}
                      </div>
                      <div className="text-sm font-semibold">{abstainVotes}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={cn('rounded-md border p-3', getBadgeToneClasses('info'))}>
                <p className="mb-1 text-sm font-semibold">
                  {t('plateJs.blockSuggestion.voteRequired')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {translateText(
                    'generated.inline.1143_cast_your_vote_for_this_change_request_25af64e8'
                  )}
                </p>
              </div>
            )}
            {canVoteOnSuggestion && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  presentation="success"
                  className={cn(
                    'flex-1',
                    currentUserVote?.vote === 'accept' && 'ring-ring ring-2 ring-offset-1'
                  )}
                  onClick={() => onVoteAccept?.(suggestion)}
                >
                  <CheckIcon className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0121_accept_bb54db51')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className={cn(
                    'flex-1',
                    currentUserVote?.vote === 'reject' && 'ring-ring ring-2 ring-offset-1'
                  )}
                  onClick={() => onVoteReject?.(suggestion)}
                >
                  <XIcon className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.1142_reject_2b03b592')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    'flex-1',
                    currentUserVote?.vote === 'abstain' && 'ring-ring ring-2 ring-offset-1'
                  )}
                  onClick={() => onVoteAbstain?.(suggestion)}
                >
                  {translateText('generated.inline.1144_abstain_bc39d849')}
                </Button>
              </div>
            )}
            {canFinalizeInternalVote && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Abstimmung beenden
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Interne Abstimmung beenden?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ergebnis: {projectedOutcome}. Accept {acceptVotes}, Reject {rejectVotes},
                      Abstain {abstainVotes}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onFinalizeInternalVote?.(suggestion);
                      }}
                    >
                      Abstimmung beenden
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        <CommentCreateForm discussionId={suggestion.suggestionId} />
      </div>

      {!isLast && <div className="bg-muted h-px w-full" />}
    </div>
  );
}

export const useResolveSuggestion = (
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[],
  blockPath: Path
) => {
  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const uniquePathMap = usePluginOption(suggestionPlugin, 'uniquePathMap');
  const TYPE_TEXT_MAP = useTypeTextMap();

  const { api, editor, getOption, setOption } = useEditorPlugin(suggestionPlugin);

  React.useEffect(() => {
    suggestionNodes.forEach(([node]) => {
      const id = api.suggestion.nodeId(node);
      const map = getOption('uniquePathMap');

      if (!id) return;

      const previousPath = map.get(id);

      // If there are no suggestion nodes in the corresponding path in the map, then update it.
      if (PathApi.isPath(previousPath)) {
        const nodes = api.suggestion.node({ id, at: previousPath, isText: true });
        const parentNode = api.node(previousPath);
        let lineBreakId: string | null = null;

        if (parentNode && ElementApi.isElement(parentNode[0])) {
          lineBreakId = api.suggestion.nodeId(parentNode[0]) ?? null;
        }

        if (!nodes && lineBreakId !== id) {
          setOption('uniquePathMap', new Map(map).set(id, blockPath));
          return;
        }

        return;
      }
      setOption('uniquePathMap', new Map(map).set(id, blockPath));
    });
  }, [api, blockPath, getOption, setOption, suggestionNodes]);

  const resolvedSuggestion: ResolvedSuggestion[] = React.useMemo(() => {
    const map = uniquePathMap;

    if (suggestionNodes.length === 0) return [];

    const suggestionIds = new Set(
      suggestionNodes
        .flatMap(([node]) => {
          if (TextApi.isText(node)) {
            const dataList = api.suggestion.dataList(node);
            const includeUpdate = dataList.some(data => data.type === 'update');

            if (!includeUpdate) return api.suggestion.nodeId(node);

            return dataList.filter(data => data.type === 'update').map(d => d.id);
          }
          if (ElementApi.isElement(node)) {
            return api.suggestion.nodeId(node);
          }
        })
        .filter(Boolean)
    );

    const res: ResolvedSuggestion[] = [];

    suggestionIds.forEach(id => {
      if (!id) return;

      const path = map.get(id);

      if (!path || !PathApi.isPath(path)) return;
      if (!PathApi.equals(path, blockPath)) return;

      const entries = [
        ...editor.api.nodes<TElement | TSuggestionText>({
          at: [],
          mode: 'all',
          match: n =>
            (n[KEYS.suggestion] && n[getSuggestionKey(id)]) ||
            api.suggestion.nodeId(n as TElement) === id,
        }),
      ];

      // move line break to the end
      entries.sort(([, path1], [, path2]) => {
        return PathApi.isChild(path1, path2) ? -1 : 1;
      });

      let newText = '';
      let text = '';
      let properties: Record<string, unknown> = {};
      let newProperties: Record<string, unknown> = {};

      // overlapping suggestion
      entries.forEach(([node]) => {
        if (TextApi.isText(node)) {
          const dataList = api.suggestion.dataList(node);

          dataList.forEach(data => {
            if (data.id !== id) return;

            switch (data.type) {
              case 'insert': {
                newText += node.text;

                break;
              }
              case 'remove': {
                text += node.text;

                break;
              }
              case 'update': {
                properties = {
                  ...properties,
                  ...data.properties,
                };

                newProperties = {
                  ...newProperties,
                  ...data.newProperties,
                };

                newText += node.text;

                break;
              }
              // No default
            }
          });
        } else {
          const lineBreakData = api.suggestion.isBlockSuggestion(node)
            ? node.suggestion
            : undefined;

          if (lineBreakData?.id !== keyId2SuggestionId(id)) return;
          if (lineBreakData.type === 'insert') {
            newText += lineBreakData.isLineBreak
              ? BLOCK_SUGGESTION
              : BLOCK_SUGGESTION + TYPE_TEXT_MAP[node.type](node);
          } else if (lineBreakData.type === 'remove') {
            text += lineBreakData.isLineBreak
              ? BLOCK_SUGGESTION
              : BLOCK_SUGGESTION + TYPE_TEXT_MAP[node.type](node);
          }
        }
      });

      if (entries.length === 0) return;

      const nodeData = api.suggestion.suggestionData(entries[0][0]);

      if (!nodeData) return;

      // Find the discussion for this suggestion to get comments AND title
      const discussion = discussions.find((s: TDiscussion) => s.id === id);
      const comments = discussion?.comments || [];
      const title = discussion?.title; // Get the title from the discussion
      const crId = discussion?.crId; // Get the CR-x ID from the discussion
      const changeRequestEntityId = discussion?.changeRequestEntityId;
      const votes = discussion?.votes; // Get the votes from the discussion
      const votesFor = discussion?.votesFor;
      const votesAgainst = discussion?.votesAgainst;
      const votesAbstain = discussion?.votesAbstain;
      const votingDeadline = discussion?.votingDeadline;
      const closeTrigger = discussion?.closeTrigger;
      const eligibleVoterCount = discussion?.eligibleVoterCount;
      const votedCollaboratorCount = discussion?.votedCollaboratorCount;
      const resolutionMethod = discussion?.resolutionMethod;
      const visibilityScope = discussion?.visibilityScope;
      const resolvedInMode = discussion?.resolvedInMode;
      const votingStatus = discussion?.votingStatus;
      const createdAt = new Date(nodeData.createdAt);

      const keyId = getSuggestionKey(id);

      if (nodeData.type === 'update') {
        return res.push({
          comments,
          crId, // Include the CR-x ID
          changeRequestEntityId,
          votes, // Include the votes
          votesFor,
          votesAgainst,
          votesAbstain,
          votingDeadline,
          closeTrigger,
          eligibleVoterCount,
          votedCollaboratorCount,
          resolutionMethod,
          visibilityScope,
          resolvedInMode,
          votingStatus,
          createdAt,
          keyId,
          newProperties,
          newText,
          properties,
          suggestionId: keyId2SuggestionId(id),
          title, // Include the title
          type: 'update',
          userId: nodeData.userId,
        });
      }
      if (newText.length > 0 && text.length > 0) {
        return res.push({
          comments,
          crId, // Include the CR-x ID
          changeRequestEntityId,
          votes, // Include the votes
          votesFor,
          votesAgainst,
          votesAbstain,
          votingDeadline,
          closeTrigger,
          eligibleVoterCount,
          votedCollaboratorCount,
          resolutionMethod,
          visibilityScope,
          resolvedInMode,
          votingStatus,
          createdAt,
          keyId,
          newText,
          suggestionId: keyId2SuggestionId(id),
          text,
          title, // Include the title
          type: 'replace',
          userId: nodeData.userId,
        });
      }
      if (newText.length > 0) {
        return res.push({
          comments,
          crId, // Include the CR-x ID
          changeRequestEntityId,
          votes, // Include the votes
          votesFor,
          votesAgainst,
          votesAbstain,
          votingDeadline,
          closeTrigger,
          eligibleVoterCount,
          votedCollaboratorCount,
          resolutionMethod,
          visibilityScope,
          resolvedInMode,
          votingStatus,
          createdAt,
          keyId,
          newText,
          suggestionId: keyId2SuggestionId(id),
          title, // Include the title
          type: 'insert',
          userId: nodeData.userId,
        });
      }
      if (text.length > 0) {
        return res.push({
          comments,
          crId, // Include the CR-x ID
          changeRequestEntityId,
          votes, // Include the votes
          votesFor,
          votesAgainst,
          votesAbstain,
          votingDeadline,
          closeTrigger,
          eligibleVoterCount,
          votedCollaboratorCount,
          resolutionMethod,
          visibilityScope,
          resolvedInMode,
          votingStatus,
          createdAt,
          keyId,
          suggestionId: keyId2SuggestionId(id),
          text,
          title, // Include the title
          type: 'remove',
          userId: nodeData.userId,
        });
      }
    });

    return res;
  }, [api.suggestion, blockPath, discussions, editor.api, suggestionNodes, uniquePathMap]);

  // Effect to ensure all suggestions have CR IDs
  React.useEffect(() => {
    const documentId = editor.getOption(discussionPlugin, 'documentId');

    if (!documentId || resolvedSuggestion.length === 0) return;

    const assignMissingIds = async () => {
      const currentDiscussions = editor.getOption(discussionPlugin, 'discussions') || [];
      let needsUpdate = false;
      const updatedDiscussions = [...currentDiscussions];

      for (const suggestion of resolvedSuggestion) {
        if (suggestion.crId) continue; // Already has CR ID

        // Find or create discussion for this suggestion
        const discussionId =
          suggestion.keyId?.replace('suggestion_', '') || suggestion.suggestionId;
        const discussion = updatedDiscussions.find((d: TDiscussion) => d.id === discussionId);

        if (!discussion) {
          // Create new discussion with CR ID
          try {
            const { getNextSuggestionIdFromDiscussions } =
              await import('@/features/shared/utils/suggestion-utils.ts');
            const crId = getNextSuggestionIdFromDiscussions(updatedDiscussions);

            const newDiscussion: TDiscussion = {
              id: discussionId,
              comments: [],
              createdAt: suggestion.createdAt || new Date(),
              isResolved: false,
              userId: suggestion.userId,
              crId,
            };

            updatedDiscussions.push(newDiscussion);
            needsUpdate = true;
          } catch (error) {
            console.error('Failed to assign CR ID to suggestion:', error);
          }
        } else if (!discussion.crId) {
          // Discussion exists but doesn't have crId
          try {
            const { getNextSuggestionIdFromDiscussions } =
              await import('@/features/shared/utils/suggestion-utils.ts');
            const crId = getNextSuggestionIdFromDiscussions(updatedDiscussions);

            const index = updatedDiscussions.findIndex(d => d.id === discussionId);
            if (index !== -1) {
              updatedDiscussions[index] = { ...updatedDiscussions[index], crId };
              needsUpdate = true;
            }
          } catch (error) {
            console.error('Failed to assign CR ID to discussion:', error);
          }
        }
      }

      if (needsUpdate) {
        editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
      }
    };

    // Run async assignment
    assignMissingIds();
  }, [resolvedSuggestion, editor]);

  return resolvedSuggestion;
};

export const isResolvedSuggestion = (
  suggestion: ResolvedSuggestion | TDiscussion
): suggestion is ResolvedSuggestion => {
  return 'suggestionId' in suggestion;
};
