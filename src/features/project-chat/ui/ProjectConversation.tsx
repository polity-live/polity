'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { Link } from '@tanstack/react-router';
import { queries } from '@/zero/queries';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import type { Conversation, Message } from '@/features/messages/types/message.types';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';
import {
  useAssistantChat,
  type AssistantToolOption,
} from '@/features/messages/hooks/useAssistantChat';
import { AssistantMessageContentView } from '@/features/messages/ui/AssistantMessageContentView';
import type { EditorContext, ProjectScope } from '../logic/contracts';
import { flushProjectEditor } from '../hooks/editor-bridge';

interface ProjectConversationProps {
  conversationId: string;
  context?: EditorContext;
  initialInstruction?: string;
  onBack?: () => void;
  messages?: Message[];
  hasMoreOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onAtEndChange?: (isAtEnd: boolean) => void;
  onTogglePin?: (id: string, currentPinned: boolean) => void;
  onDeleteClick?: (id: string) => void;
  onMembersClick?: () => void;
  onRenameConversation?: (id: string, name: string | null) => Promise<boolean>;
  onAcceptConversation?: (conversation: Conversation) => void;
  onRejectConversation?: (conversation: Conversation) => void;
  className?: string;
  swipeHandlers?: SwipeNavigationHandlers;
  compact?: boolean;
  active?: boolean;
}

function projectTools(
  scope: ProjectScope,
  t: ReturnType<typeof useTranslation>['t']
): AssistantToolOption[] {
  const tool = (name: string, label: string, description: string): AssistantToolOption => ({
    name,
    label,
    description,
    kind: 'project',
    enabled: true,
    alwaysActive: true,
  });

  if (scope.kind === 'studio') {
    return [
      tool(
        'studio_read',
        t('features.projectChat.tools.studioRead'),
        t('features.projectChat.tools.studioReadDescription')
      ),
      tool(
        'studio_apply_actions',
        t('features.projectChat.tools.studioApply'),
        t('features.projectChat.tools.studioApplyDescription')
      ),
    ];
  }

  return [
    tool(
      'amendment_read',
      t('features.projectChat.tools.amendmentRead'),
      t('features.projectChat.tools.amendmentReadDescription')
    ),
    tool(
      'amendment_apply_actions',
      t('features.projectChat.tools.amendmentApply'),
      t('features.projectChat.tools.amendmentApplyDescription')
    ),
    tool(
      'city_design_read',
      t('features.projectChat.tools.cityRead'),
      t('features.projectChat.tools.cityReadDescription')
    ),
    tool(
      'city_design_read_features',
      t('features.projectChat.tools.cityFeatures'),
      t('features.projectChat.tools.cityFeaturesDescription')
    ),
    tool(
      'city_design_catalog',
      t('features.projectChat.tools.cityCatalog'),
      t('features.projectChat.tools.cityCatalogDescription')
    ),
    tool(
      'city_design_apply_actions',
      t('features.projectChat.tools.cityApply'),
      t('features.projectChat.tools.cityApplyDescription')
    ),
  ];
}

function savedEditorContext(messages: readonly Message[]): EditorContext | undefined {
  for (const message of messages) {
    try {
      const value = JSON.parse(message.context_json ?? '{}') as {
        project?: { editorContext?: EditorContext };
      };
      if (value.project?.editorContext) return value.project.editorContext;
    } catch {
      // Older messages may contain a non-project context payload.
    }
  }
  return undefined;
}

export function ProjectConversation(props: ProjectConversationProps) {
  const { conversationId, active = true } = props;
  const { user } = useAuth();
  const zero = useZero();
  const { t } = useTranslation();
  const [conversation] = useQuery(queries.messages.conversationById({ id: conversationId }));
  const [messageLimit, setMessageLimit] = useState(80);
  const [queriedMessages] = useQuery(
    queries.messages.messagesWindow({ conversation_id: conversationId, limit: messageLimit })
  );
  const participant = conversation?.participants?.find(item => item.user_id === user?.id);
  const joinedConversation = useRef('');

  useEffect(() => {
    if (!conversation || !user || participant || joinedConversation.current === conversation.id) {
      return;
    }
    joinedConversation.current = conversation.id;
    void serverConfirmed(
      zero.mutate(
        mutators.projectChat.join({
          conversationId: conversation.id,
          participantId: crypto.randomUUID(),
        })
      )
    );
  }, [conversation, participant, user, zero]);

  useEffect(() => {
    if (!active || !participant || queriedMessages.length === 0) return;
    void serverConfirmed(
      zero.mutate(mutators.messages.markRead({ id: participant.id, last_read_at: Date.now() }))
    );
  }, [active, participant, queriedMessages, zero]);

  if (!conversation) {
    return <p className="p-4 text-sm">{t('features.projectChat.unavailable')}</p>;
  }

  const scope: ProjectScope | null = conversation.studio_project_id
    ? { kind: 'studio', projectId: conversation.studio_project_id }
    : conversation.amendment_id
      ? { kind: 'amendment', amendmentId: conversation.amendment_id }
      : null;
  if (!scope) {
    return <p className="p-4 text-sm">{t('features.projectChat.unavailable')}</p>;
  }

  return (
    <LoadedProjectConversation
      {...props}
      conversation={conversation}
      scope={scope}
      messages={props.messages ?? queriedMessages}
      internalHasMore={props.messages ? undefined : queriedMessages.length >= messageLimit}
      onInternalLoadOlder={() => setMessageLimit(limit => Math.min(500, limit + 80))}
    />
  );
}

function LoadedProjectConversation({
  conversation,
  scope,
  context,
  initialInstruction,
  messages,
  hasMoreOlderMessages,
  onLoadOlderMessages,
  onAtEndChange,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
  onRenameConversation,
  onAcceptConversation,
  onRejectConversation,
  className,
  swipeHandlers,
  compact = false,
  onBack,
  internalHasMore,
  onInternalLoadOlder,
}: ProjectConversationProps & {
  conversation: Conversation;
  scope: ProjectScope;
  messages: Message[];
  internalHasMore?: boolean;
  onInternalLoadOlder: () => void;
}) {
  const { user } = useAuth();
  const zero = useZero();
  const { t } = useTranslation();
  const [runs] = useQuery(queries.projectChat.runs({ conversationId: conversation.id }));
  const [changes] = useQuery(queries.projectChat.changes({ conversationId: conversation.id }));
  const [studioProject] = useQuery(
    scope.kind === 'studio' ? queries.studio.project({ id: scope.projectId }) : undefined
  );
  const storedContext = useMemo(() => savedEditorContext(messages), [messages]);
  const toolOptions = useMemo(() => projectTools(scope, t), [scope.kind, t]);
  const currentParticipant = conversation.participants.find(item => item.user_id === user?.id);
  const surfaceStorageKey = `project-chat-surface:${user?.id ?? 'anonymous'}:${conversation.id}`;
  const [surface, setSurface] = useState<EditorContext['surface']>(() => {
    if (context?.surface) return context.surface;
    if (
      currentParticipant?.project_surface === 'city_design' ||
      currentParticipant?.project_surface === 'amendment_text'
    ) {
      return currentParticipant.project_surface;
    }
    const local = typeof window === 'undefined' ? null : localStorage.getItem(surfaceStorageKey);
    return local === 'city_design' ? 'city_design' : 'amendment_text';
  });
  const briefingStarted = useRef(false);
  const activeRun = runs.find(run => run.status === 'running');
  const interruptedRun = runs.find(
    run => run.actor_id === user?.id && run.status === 'interrupted'
  );
  const activeRunId = activeRun && activeRun.actor_id === user?.id ? activeRun.id : null;

  useEffect(() => {
    if (context?.surface) setSurface(context.surface);
  }, [context?.surface]);

  useEffect(() => {
    if (
      !context?.surface &&
      (currentParticipant?.project_surface === 'city_design' ||
        currentParticipant?.project_surface === 'amendment_text')
    ) {
      setSurface(currentParticipant.project_surface);
    }
  }, [context?.surface, currentParticipant?.project_surface]);

  const cancelOwnRun = activeRunId
    ? async () => {
        await serverConfirmed(zero.mutate(mutators.projectChat.cancel({ runId: activeRunId })));
      }
    : undefined;

  const assistantChat = useAssistantChat(conversation, user?.id, {
    project: {
      projectTools: toolOptions,
      externallyBusy: Boolean(activeRun),
      resumeRequestId: interruptedRun?.request_id ?? null,
      onCancel: cancelOwnRun,
      beforeSend: async () => {
        const fallback: EditorContext = context ?? {
          ...storedContext,
          surface: scope.kind === 'studio' ? 'studio' : surface,
        };
        return flushProjectEditor(scope, fallback);
      },
    },
  });

  useEffect(() => {
    if (
      !initialInstruction ||
      messages.length > 0 ||
      !assistantChat.selectedModel ||
      assistantChat.isSending ||
      briefingStarted.current
    ) {
      return;
    }
    briefingStarted.current = true;
    void assistantChat.sendAssistantMessage(initialInstruction);
  }, [assistantChat, initialInstruction, messages.length]);

  const activeRunText = activeRun
    ? `${activeRun.partial_text ?? ''}${activeRun.streaming_text ?? ''}`
    : '';
  const streamingAssistantMessage =
    assistantChat.streamingText ||
    activeRunText ||
    assistantChat.isThinking ||
    assistantChat.isToolCalling ||
    assistantChat.streamError ||
    activeRun
      ? {
          text: assistantChat.streamingText || activeRunText,
          isCompressing: assistantChat.isCompressing,
          isThinking: assistantChat.isThinking || Boolean(activeRun),
          isToolCalling: assistantChat.isToolCalling,
          toolName: assistantChat.activeToolName,
          toolPreview: assistantChat.activeToolCall?.preview ?? null,
          errorMessage: assistantChat.streamError,
          canRetry: assistantChat.canRetry,
          onRetry: assistantChat.retryLastAssistantMessage,
        }
      : undefined;

  const projectHref =
    scope.kind === 'studio'
      ? studioProject?.group_id
        ? `/group/${studioProject.group_id}/studio/${scope.projectId}?conversationId=${conversation.id}`
        : `/studio/${scope.projectId}?conversationId=${conversation.id}`
      : `/amendment/${scope.amendmentId}/${surface === 'city_design' ? 'citydesign' : 'text'}?conversationId=${conversation.id}${context?.branchId ? `&branch=${context.branchId}` : ''}`;
  const canManage = conversation.requested_by_id === user?.id;
  const defaultTogglePin = (id: string, pinned: boolean) => {
    void serverConfirmed(
      zero.mutate(mutators.messages.updateConversation({ id, pinned: !pinned }))
    );
  };
  const defaultRename = async (id: string, name: string | null) => {
    try {
      await serverConfirmed(zero.mutate(mutators.messages.updateConversation({ id, name })));
      return true;
    } catch {
      return false;
    }
  };
  const defaultDelete = () => {
    if (window.confirm(t('features.messages.conversation.deleteConfirm'))) {
      void serverConfirmed(
        zero.mutate(
          mutators.messages.deleteConversationFull({
            id: conversation.id,
            messageIds: conversation.messages.map(message => message.id),
            participantIds: conversation.participants.map(participant => participant.id),
          })
        )
      );
    }
  };

  const contextActions: ReactNode = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {!context && scope.kind === 'amendment' ? (
        <label className="mr-auto flex items-center gap-2">
          <span className="text-muted-foreground">{t('features.projectChat.surface')}</span>
          <select
            className="bg-background rounded border px-2 py-1"
            value={surface}
            onChange={event => {
              const next = event.target.value as EditorContext['surface'];
              setSurface(next);
              localStorage.setItem(surfaceStorageKey, next);
              void serverConfirmed(
                zero.mutate(
                  mutators.projectChat.setSurface({
                    conversationId: conversation.id,
                    surface: next === 'city_design' ? 'city_design' : 'amendment_text',
                  })
                )
              );
            }}
          >
            <option value="amendment_text">{t('features.projectChat.text')}</option>
            <option value="city_design">{t('features.projectChat.cityDesign')}</option>
          </select>
        </label>
      ) : (
        <span className="text-muted-foreground mr-auto text-xs">
          {t('features.projectChat.shared')}
        </span>
      )}
      <a className="underline" href={projectHref}>
        {t('features.projectChat.project')}
      </a>
      {context ? (
        <Link className="underline" to="/messages" search={{ conversationId: conversation.id }}>
          {t('features.projectChat.messages')}
        </Link>
      ) : null}
    </div>
  );

  const timelineItems = changes.map(change => ({
    id: change.id,
    createdAt: change.created_at,
    content: (
      <article className="bg-muted/35 rounded-md border px-3 py-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p>{change.summary}</p>
            <p className="text-muted-foreground text-xs">
              {t(`features.projectChat.${change.status}`)}
            </p>
          </div>
          {change.status === 'applied' && change.actor_id === user?.id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void serverConfirmed(
                  zero.mutate(mutators.projectChat.undo({ changeSetId: change.id }))
                )
              }
            >
              {t('features.projectChat.undo')}
            </Button>
          ) : null}
          {change.status === 'proposed' ? (
            <a className="text-xs underline" href={projectHref}>
              {t('features.projectChat.review')}
            </a>
          ) : null}
        </div>
      </article>
    ),
  }));

  return (
    <AssistantMessageContentView
      conversation={conversation}
      messages={messages}
      hasMoreOlderMessages={hasMoreOlderMessages ?? internalHasMore}
      onLoadOlderMessages={onLoadOlderMessages ?? onInternalLoadOlder}
      onAtEndChange={onAtEndChange}
      currentUserId={user?.id}
      onBack={onBack ?? (() => undefined)}
      onTogglePin={onTogglePin ?? defaultTogglePin}
      onDeleteClick={onDeleteClick ?? defaultDelete}
      onMembersClick={onMembersClick ?? (() => undefined)}
      onRenameConversation={onRenameConversation ?? defaultRename}
      onAcceptConversation={onAcceptConversation ?? (() => undefined)}
      onRejectConversation={onRejectConversation ?? (() => undefined)}
      className={className}
      swipeHandlers={swipeHandlers}
      assistantChat={assistantChat}
      streamingAssistantMessage={streamingAssistantMessage}
      compact={compact}
      canManage={canManage}
      contextActions={contextActions}
      timelineItems={timelineItems}
    />
  );
}
