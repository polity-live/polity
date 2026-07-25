import * as React from 'react';

import type { PlateElementProps, RenderNodeWrapper } from 'platejs/react';

import { getDraftCommentKey } from '@platejs/comment';
import { CommentPlugin } from '@platejs/comment/react';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import {
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PencilLineIcon,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  type AnyPluginConfig,
  type NodeEntry,
  type Path,
  type TCommentText,
  type TElement,
  type TSuggestionText,
  PathApi,
  TextApi,
} from 'platejs';
import { useEditorPlugin, useEditorRef, usePluginOption } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/features/shared/ui/ui/popover.tsx';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog.tsx';
import { commentPlugin } from '@/features/shared/ui/kit-platejs/comment-kit.tsx';
import {
  type TDiscussion,
  discussionPlugin,
} from '@/features/shared/ui/kit-platejs/discussion-kit.tsx';
import { suggestionPlugin } from '@/features/shared/ui/kit-platejs/suggestion-kit.tsx';
import { useModeContext } from '@/features/shared/ui/kit-platejs/mode-context.tsx';

import {
  BlockSuggestionCard,
  isResolvedSuggestion,
  useResolveSuggestion,
} from './block-suggestion.tsx';
import { Comment, CommentCreateForm } from './comment.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useIsMobileScreen } from '@/features/shared/hooks/useIsMobileScreen';

export const BlockDiscussion: RenderNodeWrapper<AnyPluginConfig> = props => {
  const { editor, element } = props;

  const commentsApi = editor.getApi(CommentPlugin).comment;
  const blockPath = editor.api.findPath(element);

  // avoid duplicate in table or column
  if (!blockPath || blockPath.length > 1) return;

  const draftCommentNode = commentsApi.node({ at: blockPath, isDraft: true });

  const commentNodes = [...commentsApi.nodes({ at: blockPath })];

  const suggestionNodes = [...editor.getApi(SuggestionPlugin).suggestion.nodes({ at: blockPath })];

  if (commentNodes.length === 0 && suggestionNodes.length === 0 && !draftCommentNode) {
    return props => (
      <MobileDiscussionRailReservation>{props.children}</MobileDiscussionRailReservation>
    );
  }

  return props => (
    <BlockCommentContent
      blockPath={blockPath}
      commentNodes={commentNodes}
      draftCommentNode={draftCommentNode}
      suggestionNodes={suggestionNodes}
      {...props}
    />
  );
};

interface ResponsiveDiscussionOverlayProps {
  anchorElement: HTMLElement | null;
  blockContent: React.ReactNode;
  isMobileScreen: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  overlayContent: React.ReactNode;
  trigger: React.ReactNode;
}

interface MobileDiscussionRowProps {
  blockContent: React.ReactNode;
  trigger: React.ReactNode;
}

function MobileDiscussionRow({ blockContent, trigger }: MobileDiscussionRowProps) {
  return (
    <div className="flex w-full max-w-full items-start gap-1">
      <div className="min-w-0 flex-1 break-words">{blockContent}</div>
      <div
        className="flex w-12 shrink-0 justify-end select-none"
        data-slot="discussion-trigger-rail"
      >
        {trigger}
      </div>
    </div>
  );
}

function MobileDiscussionRailReservation({ children }: { children: React.ReactNode }) {
  const isMobileScreen = useIsMobileScreen();

  return isMobileScreen ? (
    <MobileDiscussionRow blockContent={children} trigger={null} />
  ) : (
    <React.Fragment>{children}</React.Fragment>
  );
}

export function ResponsiveDiscussionOverlay({
  anchorElement,
  blockContent,
  isMobileScreen,
  onOpenChange,
  open,
  overlayContent,
  trigger,
}: ResponsiveDiscussionOverlayProps) {
  if (isMobileScreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <MobileDiscussionRow
          blockContent={blockContent}
          trigger={trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        />

        <DialogContent
          aria-describedby={undefined}
          className="bg-popover text-popover-foreground max-h-[min(50dvh,calc(100dvh-24px))] w-[380px] max-w-[calc(100vw-24px)] min-w-[130px] overflow-y-auto rounded-md p-0"
          showCloseButton={false}
          showOverlay={false}
          onCloseAutoFocus={event => event.preventDefault()}
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {translateText('components.changeRequests.openChangeRequests', 'Change requests')}
          </DialogTitle>
          {overlayContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex w-full justify-between">
      <Popover open={open} onOpenChange={onOpenChange}>
        <div className="w-full">{blockContent}</div>
        {anchorElement ? (
          <PopoverAnchor asChild className="w-full" virtualRef={{ current: anchorElement }} />
        ) : null}

        <PopoverContent
          className="max-h-[min(50dvh,calc(-24px+var(--radix-popper-available-height)))] w-[380px] max-w-[calc(100vw-24px)] min-w-[130px] overflow-y-auto p-0 data-[state=closed]:opacity-0"
          onCloseAutoFocus={event => event.preventDefault()}
          onOpenAutoFocus={event => event.preventDefault()}
          align="center"
          side="bottom"
        >
          {overlayContent}
        </PopoverContent>

        {trigger ? (
          <div className="relative left-0 size-0 select-none">
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </div>
        ) : null}
      </Popover>
    </div>
  );
}

const BlockCommentContent = ({
  blockPath,
  children,
  commentNodes,
  draftCommentNode,
  suggestionNodes,
}: PlateElementProps & {
  blockPath: Path;
  commentNodes: NodeEntry<TCommentText>[];
  draftCommentNode: NodeEntry<TCommentText> | undefined;
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[];
}) => {
  const editor = useEditorRef();
  const { selectedCrIds } = useModeContext();
  const isMobileScreen = useIsMobileScreen();

  const resolvedSuggestions = useResolveSuggestion(suggestionNodes, blockPath);
  const openSuggestions = resolvedSuggestions.filter(
    suggestion =>
      suggestion.votingStatus !== 'completed' &&
      !['accepted', 'approved', 'rejected', 'declined'].includes(
        suggestion.changeRequestStatus ?? ''
      )
  );
  const resolvedDiscussions = useResolvedDiscussion(commentNodes, blockPath);

  // Filter suggestions when specific CRs are selected
  const filteredSuggestions = selectedCrIds
    ? openSuggestions.filter(s => s.crId != null && selectedCrIds.has(s.crId))
    : openSuggestions;

  const suggestionsCount = filteredSuggestions.length;
  const discussionsCount = resolvedDiscussions.length;
  const totalCount = suggestionsCount + discussionsCount;

  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const activeSuggestion =
    activeSuggestionId && filteredSuggestions.find(s => s.suggestionId === activeSuggestionId);

  const commentingBlock = usePluginOption(commentPlugin, 'commentingBlock');
  const activeCommentId = usePluginOption(commentPlugin, 'activeId');
  const isCommenting = activeCommentId === getDraftCommentKey();
  const activeDiscussion =
    activeCommentId && resolvedDiscussions.find(d => d.id === activeCommentId);

  const noneActive = !activeSuggestion && !activeDiscussion;

  const sortedMergedData = [...resolvedDiscussions, ...filteredSuggestions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const selected =
    resolvedDiscussions.some(d => d.id === activeCommentId) ||
    filteredSuggestions.some(s => s.suggestionId === activeSuggestionId);

  const [_open, setOpen] = React.useState(selected);

  // in some cases, we may comment the multiple blocks
  const commentingCurrent = !!commentingBlock && PathApi.equals(blockPath, commentingBlock);

  const open = _open || selected || (isCommenting && !!draftCommentNode && commentingCurrent);

  const anchorElement = React.useMemo(() => {
    let activeNode: NodeEntry | undefined;

    if (activeSuggestion) {
      activeNode = suggestionNodes.find(
        ([node]) =>
          TextApi.isText(node) &&
          editor.getApi(SuggestionPlugin).suggestion.nodeId(node) === activeSuggestion.suggestionId
      );
    }

    if (activeCommentId) {
      if (activeCommentId === getDraftCommentKey()) {
        activeNode = draftCommentNode;
      } else {
        activeNode = commentNodes.find(
          ([node]) => editor.getApi(commentPlugin).comment.nodeId(node) === activeCommentId
        );
      }
    }

    if (!activeNode) return null;

    return editor.api.toDOMNode(activeNode[0]) ?? null;
  }, [
    open,
    activeSuggestion,
    activeCommentId,
    editor.api,
    suggestionNodes,
    draftCommentNode,
    commentNodes,
  ]);

  if (suggestionsCount + resolvedDiscussions.length === 0 && !draftCommentNode) {
    return isMobileScreen ? (
      <MobileDiscussionRow blockContent={children} trigger={null} />
    ) : (
      <div className="w-full">{children}</div>
    );
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isCommenting && draftCommentNode) {
      editor.tf.unsetNodes(getDraftCommentKey(), {
        at: [],
        mode: 'lowest',
        match: n => n[getDraftCommentKey()],
      });
    }
    setOpen(nextOpen);
  };

  const discussionContent = isCommenting ? (
    <CommentCreateForm className="p-4" focusOnMount />
  ) : (
    <React.Fragment>
      {noneActive ? (
        sortedMergedData.map((item, index) =>
          isResolvedSuggestion(item) ? (
            <BlockSuggestionCard
              key={item.suggestionId}
              idx={index}
              isLast={index === sortedMergedData.length - 1}
              suggestion={item}
            />
          ) : (
            <BlockComment
              key={item.id}
              discussion={item}
              isLast={index === sortedMergedData.length - 1}
            />
          )
        )
      ) : (
        <React.Fragment>
          {activeSuggestion && (
            <BlockSuggestionCard
              key={activeSuggestion.suggestionId}
              idx={0}
              isLast={true}
              suggestion={activeSuggestion}
            />
          )}

          {activeDiscussion && <BlockComment discussion={activeDiscussion} isLast={true} />}
        </React.Fragment>
      )}
    </React.Fragment>
  );

  const triggerButton = (
    <Button
      variant="ghost"
      className="text-muted-foreground/80 hover:text-muted-foreground/80 data-[active=true]:bg-muted mt-1 ml-0 flex h-6 gap-1 !px-1.5 py-0 md:ml-1"
      data-active={open}
      data-suggestion-ids={
        filteredSuggestions.length > 0
          ? filteredSuggestions.map(suggestion => suggestion.suggestionId).join(' ')
          : undefined
      }
      contentEditable={false}
    >
      {suggestionsCount > 0 && discussionsCount === 0 && (
        <PencilLineIcon className="size-4 shrink-0" />
      )}

      {suggestionsCount === 0 && discussionsCount > 0 && (
        <MessageSquareTextIcon className="size-4 shrink-0" />
      )}

      {suggestionsCount > 0 && discussionsCount > 0 && (
        <MessagesSquareIcon className="size-4 shrink-0" />
      )}

      <span className="text-xs font-semibold">{totalCount}</span>
    </Button>
  );

  return (
    <ResponsiveDiscussionOverlay
      anchorElement={anchorElement}
      blockContent={children}
      isMobileScreen={isMobileScreen}
      onOpenChange={handleOpenChange}
      open={open}
      overlayContent={discussionContent}
      trigger={totalCount > 0 ? triggerButton : null}
    />
  );
};

function BlockComment({ discussion, isLast }: { discussion: TDiscussion; isLast: boolean }) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleValue, setTitleValue] = React.useState(discussion.title || '');
  const documentTitle = usePluginOption(discussionPlugin, 'documentTitle');
  const editor = useEditorRef();
  const [isCommenting, setIsCommenting] = React.useState(false);
  const [initialComment, ...replyComments] = discussion.comments;

  const handleSaveTitle = () => {
    const updatedDiscussions = editor
      .getOption(discussionPlugin, 'discussions')
      .map((d: TDiscussion) => {
        if (d.id === discussion.id) {
          return { ...d, title: titleValue };
        }
        return d;
      });
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
    setEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setTitleValue(discussion.title || '');
    setEditingTitle(false);
  };

  return (
    <React.Fragment key={discussion.id}>
      <div className="p-4">
        {/* Discussion Title */}
        <div className="mb-3 flex items-center gap-2">
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                placeholder={translateText('generated.inline.1138_enter_discussion_title_9e501e2d')}
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
            <div className="bg-muted/30 flex flex-1 items-center gap-2 rounded-md px-3 py-2">
              <span className="text-sm font-semibold">
                {discussion.title ||
                  translateText('generated.inline.0141_untitled_discussion_496c6e50')}
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

        {/* Document Title Display */}
        {documentTitle && (
          <div className="bg-muted/50 mb-3 flex items-center gap-2 rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">
              {translateText('generated.inline.1139_document_29abfbf3')}
            </span>
            <span className="text-xs font-semibold">{documentTitle}</span>
          </div>
        )}

        {initialComment ? (
          <Comment
            key={initialComment.id}
            comment={initialComment}
            discussionLength={discussion.comments.length}
            documentContent={discussion?.documentContent}
            editingId={editingId}
            index={0}
            setEditingId={setEditingId}
            showDocumentContent
            onReply={() => setIsCommenting(true)}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            presentation="mutedTiny"
            className="h-7 px-2"
            onClick={() => setIsCommenting(true)}
          >
            <MessageSquareTextIcon className="size-3.5" />
            {translateText('generated.inline.0396_add_comment_d89450c8')}
          </Button>
        )}
        {isCommenting ? (
          <CommentCreateForm
            discussionId={discussion.id}
            focusOnMount
            onSubmitted={() => setIsCommenting(false)}
          />
        ) : null}
        {replyComments.map((comment, replyIndex) => (
          <Comment
            key={comment.id ?? replyIndex}
            comment={comment}
            discussionLength={discussion.comments.length}
            documentContent={discussion?.documentContent}
            editingId={editingId}
            index={replyIndex + 1}
            setEditingId={setEditingId}
            showDocumentContent
          />
        ))}
      </div>

      {!isLast && <div className="h-2" />}
    </React.Fragment>
  );
}

const useResolvedDiscussion = (commentNodes: NodeEntry<TCommentText>[], blockPath: Path) => {
  const { api, getOption, setOption } = useEditorPlugin(commentPlugin);

  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const uniquePathMap = usePluginOption(commentPlugin, 'uniquePathMap');

  React.useEffect(() => {
    commentNodes.forEach(([node]) => {
      const id = api.comment.nodeId(node);
      const map = getOption('uniquePathMap');

      if (!id) return;

      const previousPath = map.get(id);

      // If there are no comment nodes in the corresponding path in the map, then update it.
      if (PathApi.isPath(previousPath)) {
        const nodes = api.comment.node({ id, at: previousPath });

        if (!nodes) {
          setOption('uniquePathMap', new Map(map).set(id, blockPath));
          return;
        }

        return;
      }
      // Fallback: set path when previousPath is not a valid path
      setOption('uniquePathMap', new Map(map).set(id, blockPath));
    });
  }, [api.comment, blockPath, commentNodes, getOption, setOption]);

  const commentsIds = new Set(
    commentNodes.map(([node]) => api.comment.nodeId(node)).filter(Boolean)
  );

  const resolvedDiscussions = discussions
    .map((d: TDiscussion) => ({
      ...d,
      createdAt: new Date(d.createdAt),
    }))
    .filter((item: TDiscussion) => {
      /** If comment cross blocks just show it in the first block */
      const firstBlockPath = uniquePathMap.get(item.id);

      if (!firstBlockPath) return false;
      if (!PathApi.equals(firstBlockPath, blockPath)) return false;

      return api.comment.has({ id: item.id }) && commentsIds.has(item.id) && !item.isResolved;
    });

  return resolvedDiscussions;
};
