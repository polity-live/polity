/**
 * Unified Editor Hook
 *
 * Main hook for managing editor state across all entity types.
 * Handles content loading, saving, real-time sync, and discussions.
 *
 * @module features/editor/hooks/useEditor
 *
 * @example
 * ```tsx
 * import { useEditor } from '@/features/editor';
 *
 * function MyEditorPage({ entityId }) {
 *   const {
 *     title, content, discussions, mode,
 *     setTitle, setContent, setDiscussions, setMode,
 *     saveStatus, hasUnsavedChanges, isLoading
 *   } = useEditor({
 *     entityType: 'amendment',
 *     entityId,
 *     userId: user?.id,
 *   });
 *
 *   return (
 *     <PlateEditor
 *       value={content}
 *       onChange={setContent}
 *       discussions={discussions}
 *       onDiscussionsUpdate={setDiscussions}
 *     />
 *   );
 * }
 * ```
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { Value } from 'platejs';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useDocumentState } from '@/zero/documents/useDocumentState';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from '@/features/shared/ui/ui/sonner';
import {
  editorSelectionDebugLog,
  summarizeDiscussions,
  summarizeRichTextValue,
} from '@/features/shared/logic/editorSelectionDebug';
import {
  getBranchEditingModeDisabledReasons,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import {
  adaptAmendmentToEntity,
  adaptBlogToEntity,
  adaptDocumentToEntity,
  adaptGroupDocumentToEntity,
} from '../logic/entity-adapter';
import { useRealtimeSync } from './useRealtimeSync';
import type {
  EditorEntityType,
  EditorEntity,
  EditorMode,
  EditorState,
  EditorActions,
  EditorCapabilities,
  TDiscussion,
} from '../types';
import { DEFAULT_CAPABILITIES, DEFAULT_EDITOR_CONTENT } from '../types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const PERSISTED_CHANGE_REQUEST_DISCUSSION_FIELDS = [
  'crId',
  'displayCrId',
  'changeRequestEntityId',
  'changeRequestStatus',
  'status',
  'confirmationStatus',
  'confirmedAt',
  'branchDisplayNumber',
  'branchScopedCrNumber',
  'branchSequenceNumber',
  'votesFor',
  'votesAgainst',
  'votesAbstain',
  'votingDeadline',
  'closeTrigger',
  'eligibleVoterCount',
  'votedCollaboratorCount',
  'resolutionMethod',
  'visibilityScope',
  'resolvedInMode',
  'votingStatus',
  'votes',
] as const;

function mergePersistedChangeRequestDiscussionFields(
  localDiscussions: TDiscussion[],
  remoteDiscussions: TDiscussion[]
): TDiscussion[] {
  const remoteById = new Map(remoteDiscussions.map(discussion => [discussion.id, discussion]));
  const localIds = new Set(localDiscussions.map(discussion => discussion.id));
  let changed = false;

  const merged = localDiscussions.map(discussion => {
    const remoteDiscussion = remoteById.get(discussion.id);
    if (!remoteDiscussion) return discussion;

    let nextDiscussion = discussion;
    for (const field of PERSISTED_CHANGE_REQUEST_DISCUSSION_FIELDS) {
      if (JSON.stringify(nextDiscussion[field]) === JSON.stringify(remoteDiscussion[field])) {
        continue;
      }

      nextDiscussion = { ...nextDiscussion, [field]: remoteDiscussion[field] };
      changed = true;
    }

    return nextDiscussion;
  });

  for (const remoteDiscussion of remoteDiscussions) {
    if (localIds.has(remoteDiscussion.id)) continue;
    merged.push(remoteDiscussion);
    changed = true;
  }

  return changed ? merged : localDiscussions;
}

/**
 * Options for the useEditor hook
 */
interface UseEditorOptions {
  /** The type of entity being edited */
  entityType: EditorEntityType;
  /** The ID of the entity to edit */
  entityId: string;
  /** Current user ID (required for saving) */
  userId?: string;
  /** For group documents - the parent group ID */
  groupId?: string;
  /** Override default capabilities for this entity type */
  capabilities?: Partial<EditorCapabilities>;
  /** Agenda item ID for amendment CR voting initialization */
  agendaItemId?: string;
  /** Branch-specific amendment text variant */
  processBranchId?: string | null;
  /** Force the editor into a read-only UI mode */
  readOnly?: boolean;
}

/**
 * Unified editor hook for all entity types
 *
 * @param options - Editor configuration options
 * @returns Editor state and actions
 */
export function useEditor(options: UseEditorOptions): EditorState & EditorActions {
  const { entityType, entityId, userId, groupId, readOnly = false } = options;
  const zero = useZero();

  // Query data based on entity type via facade hooks
  const amId = entityType === 'amendment' ? entityId : undefined;
  const blId = entityType === 'blog' ? entityId : undefined;
  const dcId = entityType === 'document' || entityType === 'groupDocument' ? entityId : '';

  const { amendmentDocsCollabs, isLoading: amendmentLoading } = useAmendmentState({
    amendmentId: amId,
    includeDocsAndCollabs: !!amId,
  });

  const { blogForEditor, isLoading: blogLoading } = useBlogState({
    blogId: blId,
    includeForEditor: !!blId,
  });

  const { document: documentData, isLoading: documentLoading } = useDocumentState({
    documentId: dcId,
    includeCollaborators: true,
  });

  // State
  const [title, setTitleState] = useState('');
  const [content, setContentState] = useState<Value>(DEFAULT_EDITOR_CONTENT);
  const [discussions, setDiscussionsState] = useState<TDiscussion[]>([]);
  const [mode, setModeState] = useState<EditorMode>('edit');
  const [selectedCrIds, setSelectedCrIds] = useState<Set<string> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Refs to prevent re-renders and update loops
  const isInitialized = useRef(false);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTime = useRef<number>(0);
  const isLocalChange = useRef(false);
  const lastRemoteUpdate = useRef<number>(0);
  const lastDiscussionsSave = useRef<number>(0);
  const initializedEntityContextKey = useRef<string | null>(null);
  const pendingModeChange = useRef<{
    branchId: string | null;
    contextKey: string | null;
    mode: EditorMode;
  } | null>(null);

  // Derive loading state
  const isLoading =
    (entityType === 'amendment' && amendmentLoading) ||
    (entityType === 'blog' && blogLoading) ||
    (entityType === 'document' && documentLoading) ||
    (entityType === 'groupDocument' && documentLoading);

  // Adapt raw data to EditorEntity
  const selectedProcessBranch = useMemo(() => {
    if (entityType !== 'amendment' || !amendmentDocsCollabs?.current_process_run) {
      return null;
    }

    const branches = amendmentDocsCollabs.current_process_run.branches ?? [];
    if (options.processBranchId) {
      const requestedBranch = branches.find(branch => branch.id === options.processBranchId);
      if (requestedBranch) {
        return requestedBranch;
      }
    }

    const agendaBranch = options.agendaItemId
      ? branches.find(branch =>
          (branch.step_runs ?? []).some(step => step.agenda_item_id === options.agendaItemId)
        )
      : null;
    const selectedBranchId = resolveSelectedBranchId({
      branches,
      requestedBranchId: agendaBranch?.id ?? options.processBranchId,
      activeBranchId: amendmentDocsCollabs.current_process_run.active_branch_id,
    });

    return (
      branches.find(branch => branch.id === selectedBranchId) ??
      amendmentDocsCollabs.current_process_run.active_branch ??
      null
    );
  }, [
    amendmentDocsCollabs?.current_process_run,
    entityType,
    options.agendaItemId,
    options.processBranchId,
  ]);

  const entity = useMemo<EditorEntity | null>(() => {
    switch (entityType) {
      case 'amendment': {
        if (!amendmentDocsCollabs) return null;
        const doc = selectedProcessBranch?.document ?? amendmentDocsCollabs.document;
        if (!doc) return null;
        return adaptAmendmentToEntity(amendmentDocsCollabs, doc, userId, {
          processBranch: selectedProcessBranch,
          processBranches: amendmentDocsCollabs.current_process_run?.branches ?? [],
        });
      }
      case 'blog': {
        if (!blogForEditor) return null;
        return adaptBlogToEntity(blogForEditor);
      }
      case 'document': {
        if (!documentData) return null;
        return adaptDocumentToEntity(documentData);
      }
      case 'groupDocument': {
        if (!documentData) return null;
        return adaptGroupDocumentToEntity(documentData, groupId || '', undefined);
      }
      default:
        return null;
    }
  }, [
    entityType,
    entityId,
    amendmentDocsCollabs,
    blogForEditor,
    documentData,
    groupId,
    selectedProcessBranch,
    userId,
  ]);

  // Get the content entity ID (document ID for amendments, blog ID for blogs, etc.)
  const contentEntityId = useMemo(() => {
    if (entityType === 'amendment') {
      return selectedProcessBranch?.document?.id ?? amendmentDocsCollabs?.document?.id ?? '';
    }
    return entityId;
  }, [entityType, entityId, amendmentDocsCollabs, selectedProcessBranch?.document?.id]);

  const entityContextKey = useMemo(() => {
    if (!entity) return null;
    return `${entity.id}:${entity.metadata?.processBranchId ?? 'main'}`;
  }, [entity]);

  const effectiveProcessBranchId = useMemo(() => {
    if (entityType !== 'amendment') return null;

    const branches = amendmentDocsCollabs?.current_process_run?.branches ?? [];
    return (
      entity?.metadata?.processBranchId ??
      selectedProcessBranch?.id ??
      options.processBranchId ??
      resolveSelectedBranchId({
        branches,
        requestedBranchId: null,
        activeBranchId: amendmentDocsCollabs?.current_process_run?.active_branch_id,
      })
    );
  }, [
    amendmentDocsCollabs?.current_process_run?.active_branch_id,
    amendmentDocsCollabs?.current_process_run?.branches,
    entity?.metadata?.processBranchId,
    entityType,
    options.processBranchId,
    selectedProcessBranch?.id,
  ]);

  const modeDisabledReasons = useMemo(
    () =>
      entityType === 'amendment' ? getBranchEditingModeDisabledReasons(selectedProcessBranch) : {},
    [entityType, selectedProcessBranch]
  );

  // Handler for remote content arriving via broadcast (does NOT persist to Zero)
  const handleRemoteContent = useCallback(
    (remoteContent: Value) => {
      if (!isInitialized.current) return;
      editorSelectionDebugLog('content-source:realtime-broadcast', {
        contentEntityId,
        contentSignature: summarizeRichTextValue(remoteContent),
        entityId,
        entityType,
      });
      lastRemoteUpdate.current = Date.now();
      setContentState(remoteContent);
    },
    [contentEntityId, entityId, entityType]
  );

  // Real-time content broadcasting via Supabase
  const { broadcastContent } = useRealtimeSync({
    entityId: contentEntityId,
    userId,
    content,
    onRemoteContent: handleRemoteContent,
    enabled: !!contentEntityId && !!userId && !readOnly,
  });

  // Initialize entity data
  useEffect(() => {
    if (
      entity &&
      entityContextKey &&
      (!isInitialized.current || initializedEntityContextKey.current !== entityContextKey)
    ) {
      const initialContent = entity.content?.length ? entity.content : DEFAULT_EDITOR_CONTENT;
      editorSelectionDebugLog('content-source:init', {
        contentEntityId,
        contentSignature: summarizeRichTextValue(initialContent),
        entityContextKey,
        entityId,
        entityType,
      });
      setTitleState(entity.title || '');
      setContentState(initialContent);
      setDiscussionsState(entity.discussions || []);
      setModeState(entity.editingMode || 'edit');
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setSelectedCrIds(null);
      isLocalChange.current = false;
      pendingModeChange.current = null;
      isInitialized.current = true;
      initializedEntityContextKey.current = entityContextKey;
      lastRemoteUpdate.current = entity.updatedAt || Date.now();
    }
  }, [contentEntityId, entity, entityContextKey, entityId, entityType]);

  useEffect(() => {
    if (!entity || !isInitialized.current) return;
    const remoteMode = entity.editingMode || 'edit';
    const branchId = entity.metadata?.processBranchId ?? null;
    const pending = pendingModeChange.current;

    if (pending?.contextKey === entityContextKey && pending.branchId === branchId) {
      if (remoteMode !== pending.mode) {
        return;
      }
      pendingModeChange.current = null;
    }

    setModeState(currentMode => {
      return currentMode === remoteMode ? currentMode : remoteMode;
    });
  }, [entity?.editingMode, entity?.metadata?.processBranchId, entityContextKey]);

  // Sync discussions from database in real-time.
  // Only pull remote discussions when we haven't saved recently — prevents
  // overwriting local comments/votes with stale data before the poke arrives.
  useEffect(() => {
    if (!entity || !isInitialized.current) return;

    const remoteDiscussions = entity.discussions || [];
    if (!remoteDiscussions.length && !discussions.length) return;
    const nextDiscussions =
      Date.now() - lastDiscussionsSave.current < 5000
        ? mergePersistedChangeRequestDiscussionFields(discussions, remoteDiscussions)
        : remoteDiscussions;

    const remoteDiscussionsStr = JSON.stringify(nextDiscussions);
    const localDiscussionsStr = JSON.stringify(discussions);

    if (localDiscussionsStr !== remoteDiscussionsStr) {
      setDiscussionsState(nextDiscussions);
    }
  }, [discussions, entity?.discussions]);

  // Sync remote content updates without destroying local selection.
  // Only applies when a genuinely new remote version arrives and the user
  // is NOT actively typing (no pending local changes, no recent save).
  useEffect(() => {
    if (!entity || !isInitialized.current) return;
    // Skip if we have an active local edit in progress
    if (isLocalChange.current || hasUnsavedChanges) return;
    // Skip if a save just happened (the poke is echoing our own write)
    if (Date.now() - lastSaveTime.current < 2000) return;

    const remoteUpdatedAt = entity.updatedAt || 0;
    if (remoteUpdatedAt <= lastRemoteUpdate.current) return;

    const remoteContent = entity.content?.length ? entity.content : DEFAULT_EDITOR_CONTENT;
    editorSelectionDebugLog('content-source:zero-remote-update', {
      contentEntityId,
      contentSignature: summarizeRichTextValue(remoteContent),
      entityId,
      entityType,
      lastRemoteUpdate: lastRemoteUpdate.current,
      remoteUpdatedAt,
    });
    setContentState(remoteContent);
    lastRemoteUpdate.current = remoteUpdatedAt;
  }, [
    contentEntityId,
    entity,
    entity?.content,
    entity?.updatedAt,
    entityId,
    entityType,
    hasUnsavedChanges,
  ]);

  // Reset local change flag
  useEffect(() => {
    if (isLocalChange.current) {
      const timeout = setTimeout(() => {
        isLocalChange.current = false;
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [entity?.content]);

  // Persist content via Zero
  const saveContent = useCallback(
    async (newContent: Value) => {
      if (readOnly) {
        return;
      }

      setSaveStatus('saving');
      try {
        if (entityType === 'blog') {
          await zero.mutate(
            mutators.blogs.update({
              id: contentEntityId,
              content: newContent as ReadonlyJSONValue[],
            })
          );
        } else {
          await zero.mutate(
            mutators.documents.updateContent({
              id: contentEntityId,
              content: newContent as ReadonlyJSONValue[],
            })
          );
        }
        lastSaveTime.current = Date.now();
        lastRemoteUpdate.current = Date.now();
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Content save failed:', error);
        setSaveStatus('error');
      }
    },
    [entityType, contentEntityId, readOnly, zero]
  );

  // Content change handler - throttled with trailing edge
  const setContent = useCallback(
    (newContent: Value) => {
      if (readOnly) {
        return;
      }

      if (!contentEntityId || !userId) {
        console.warn('⚠️ Cannot save: missing entityId or userId', { contentEntityId, userId });
        return;
      }

      isLocalChange.current = true;
      // Don't call setContentState — the editor already has this content.
      // Updating React state here would trigger a re-render cascade:
      //   useEditor → EditorView → PlateEditor → controlled value effect
      // Content state only updates from external sources (init, remote, restore).
      setHasUnsavedChanges(true);

      // Broadcast to peers via Supabase Realtime
      broadcastContent(newContent);

      // Clear pending trailing save
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current);
      }

      const now = Date.now();
      if (now - lastSaveTime.current >= 1000) {
        // Leading edge: save immediately
        saveContent(newContent);
      } else {
        // Trailing edge: schedule save after throttle window
        contentSaveTimeoutRef.current = setTimeout(() => {
          saveContent(newContent);
        }, 1000);
      }
    },
    [contentEntityId, userId, saveContent, broadcastContent, readOnly]
  );

  // Title change handler - debounced
  const setTitle = useCallback(
    (newTitle: string) => {
      if (readOnly) {
        return;
      }

      setTitleState(newTitle);

      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }

      titleSaveTimeoutRef.current = setTimeout(async () => {
        if (!userId) return;

        setIsSavingTitle(true);
        try {
          if (entityType === 'amendment') {
            await zero.mutate(mutators.amendments.update({ id: entityId, title: newTitle }));
          } else if (entityType === 'blog') {
            await zero.mutate(mutators.blogs.update({ id: contentEntityId, title: newTitle }));
          } else if (entityType === 'document') {
            const amendmentId = documentData?.amendment_id;
            if (!amendmentId) {
              throw new Error('Cannot save document title: missing parent amendment id');
            }
            await zero.mutate(mutators.amendments.update({ id: amendmentId, title: newTitle }));
          } else if (entityType === 'groupDocument') {
            await zero.mutate(
              mutators.documents.updateGroupDocumentTitle({
                document_id: contentEntityId,
                title: newTitle,
              })
            );
          } else {
            // Documents don't have a title field — title lives on the parent entity
          }
        } catch (error) {
          console.error('Failed to save title:', error);
          toast.error(translateText('generated.inline.0415_failed_to_save_title_8dd73295'));
        } finally {
          setIsSavingTitle(false);
        }
      }, 500);
    },
    [entityType, entityId, contentEntityId, userId, zero, documentData?.amendment_id, readOnly]
  );

  // Discussions change handler
  const setDiscussions = useCallback(
    async (newDiscussions: TDiscussion[]) => {
      editorSelectionDebugLog('editor-set-discussions:start', {
        contentEntityId,
        entityId,
        entityType,
        lastDiscussionsSave: lastDiscussionsSave.current,
        newDiscussions: summarizeDiscussions(newDiscussions),
        oldDiscussions: summarizeDiscussions(discussions),
        readOnly,
      });

      if (readOnly) {
        editorSelectionDebugLog('editor-set-discussions:skip-readonly', {
          contentEntityId,
          entityId,
          entityType,
        });
        return;
      }

      // Skip if nothing changed — polling fires every 2s even when idle.
      // Without this guard, lastDiscussionsSave gets bumped constantly,
      // which blocks the sync effect from applying remote updates.
      const newStr = JSON.stringify(newDiscussions);
      const oldStr = JSON.stringify(discussions);
      if (newStr === oldStr) {
        editorSelectionDebugLog('editor-set-discussions:skip-same', {
          contentEntityId,
          entityId,
          entityType,
          lastDiscussionsSave: lastDiscussionsSave.current,
          newDiscussions: summarizeDiscussions(newDiscussions),
        });
        return;
      }

      setDiscussionsState(newDiscussions);
      lastDiscussionsSave.current = Date.now();

      editorSelectionDebugLog('editor-set-discussions:state-updated', {
        contentEntityId,
        entityId,
        entityType,
        lastDiscussionsSave: lastDiscussionsSave.current,
        newDiscussions: summarizeDiscussions(newDiscussions),
      });

      if (!contentEntityId || !userId) {
        editorSelectionDebugLog('editor-set-discussions:skip-persist-missing-context', {
          contentEntityId,
          entityId,
          entityType,
          hasUserId: Boolean(userId),
        });
        return;
      }

      try {
        const serializedDiscussions: ReadonlyJSONValue = JSON.parse(newStr);
        editorSelectionDebugLog('editor-set-discussions:persist-start', {
          contentEntityId,
          entityId,
          entityType,
          processBranchId: entity?.metadata?.processBranchId ?? null,
          serializedDiscussions: summarizeDiscussions(newDiscussions),
        });

        if (entityType === 'blog') {
          await zero.mutate(
            mutators.blogs.update({ id: contentEntityId, discussions: serializedDiscussions })
          );
        } else if (entityType === 'amendment') {
          const processBranchId = entity?.metadata?.processBranchId;
          if (processBranchId) {
            await zero.mutate(
              mutators.amendments.updateProcessBranch({
                id: processBranchId,
                discussions: serializedDiscussions,
              })
            );
          } else {
            // Amendments store main-text discussions as a JSON column on the amendment row.
            await zero.mutate(
              mutators.amendments.update({ id: entityId, discussions: serializedDiscussions })
            );
          }
        }
        // Documents and groupDocuments don't have a discussions column —
        // their discussion data lives in the thread/comment tables.
        editorSelectionDebugLog('editor-set-discussions:persist-success', {
          contentEntityId,
          entityId,
          entityType,
          processBranchId: entity?.metadata?.processBranchId ?? null,
        });
      } catch (error) {
        editorSelectionDebugLog('editor-set-discussions:persist-error', {
          contentEntityId,
          entityId,
          entityType,
          error:
            error instanceof Error ? { message: error.message, name: error.name } : String(error),
        });
        console.error('Failed to save discussions:', error);
      }
    },
    [
      entityType,
      entityId,
      contentEntityId,
      userId,
      zero,
      discussions,
      readOnly,
      entity?.metadata?.processBranchId,
    ]
  );

  // Mode change handler
  const setMode = useCallback(
    async (newMode: EditorMode) => {
      if (readOnly) {
        return;
      }

      if (!contentEntityId) return;

      const previousMode = mode;
      const processBranchId = entityType === 'amendment' ? effectiveProcessBranchId : null;
      pendingModeChange.current = {
        branchId: processBranchId,
        contextKey: entityContextKey,
        mode: newMode,
      };
      setModeState(newMode);

      try {
        if (entityType === 'amendment') {
          const result = processBranchId
            ? zero.mutate(
                mutators.amendments.updateProcessBranch({
                  id: processBranchId,
                  editing_mode: newMode,
                })
              )
            : zero.mutate(
                mutators.documents.updateContent({
                  id: contentEntityId,
                  editing_mode: newMode,
                })
              );
          await serverConfirmed(result);
        } else if (entityType === 'blog') {
          const result = zero.mutate(
            mutators.blogs.update({ id: contentEntityId, editing_mode: newMode })
          );
          await serverConfirmed(result);
        } else {
          const result = zero.mutate(
            mutators.documents.updateContent({ id: contentEntityId, editing_mode: newMode })
          );
          await serverConfirmed(result);
        }

        toast.success(`Mode changed to ${newMode}`);
      } catch (error) {
        if (pendingModeChange.current?.contextKey === entityContextKey) {
          pendingModeChange.current = null;
          setModeState(entity?.editingMode || previousMode);
        }
        console.error('Failed to change mode:', error);
        toast.error(translateText('generated.inline.0416_failed_to_change_mode_324234e0'));
        throw error;
      }
    },
    [
      entityType,
      contentEntityId,
      effectiveProcessBranchId,
      mode,
      zero,
      readOnly,
      entity?.metadata?.processBranchId,
      entity?.editingMode,
      entityContextKey,
    ]
  );

  // Restore version handler
  const handleRestoreVersion = useCallback(
    async (versionContent: Value) => {
      if (readOnly) {
        return;
      }

      if (!contentEntityId || !userId) return;

      try {
        if (entityType === 'blog') {
          await zero.mutate(
            mutators.blogs.update({
              id: contentEntityId,
              content: versionContent as ReadonlyJSONValue[],
            })
          );
        } else {
          await zero.mutate(
            mutators.documents.updateContent({
              id: contentEntityId,
              content: versionContent as ReadonlyJSONValue[],
            })
          );
        }
        isLocalChange.current = true;
        editorSelectionDebugLog('content-source:restore-version', {
          contentEntityId,
          contentSignature: summarizeRichTextValue(versionContent),
          entityId,
          entityType,
        });
        setContentState(versionContent);
        lastSaveTime.current = Date.now();
        lastRemoteUpdate.current = Date.now();
        toast.success(
          translateText('generated.inline.0417_version_restored_successfully_482a4dad')
        );
      } catch (error) {
        console.error('Failed to restore version:', error);
        toast.error(translateText('generated.inline.0418_failed_to_restore_version_2a2ef8d8'));
      }
    },
    [entityType, contentEntityId, entityId, userId, zero, readOnly]
  );

  // Access checks
  const hasAccess = useMemo(() => {
    if (!entity) return false;
    if (entityType === 'groupDocument') return true;
    if (entity.visibility === 'public') return true;
    if (entity.visibility === 'authenticated' && !!userId) return true;
    if (!userId) return false;
    if (entity.owner?.id === userId) return true;
    return entity.collaborators.some(c => c.user.id === userId);
  }, [entity, entityType, userId]);

  const isOwnerOrCollaborator = useMemo(() => {
    if (!entity || !userId) return false;
    if (entityType === 'amendment') return Boolean(entity.canChangeMode);
    if (entity.owner?.id === userId) return true;
    return entity.collaborators.some(
      c => c.user.id === userId && (c.status === 'owner' || c.status === 'admin' || c.canEdit)
    );
  }, [entity, entityType, userId]);

  // Merge capabilities
  const capabilities = useMemo(() => {
    const defaults = DEFAULT_CAPABILITIES[entityType];
    return { ...defaults, ...options.capabilities };
  }, [entityType, options.capabilities]);

  const canVoteOnChangeRequests = useMemo(() => {
    if (entityType !== 'amendment') return capabilities.voting;
    return Boolean(entity?.canVoteOnChangeRequests);
  }, [capabilities.voting, entity?.canVoteOnChangeRequests, entityType]);

  const canManageChangeRequestVotes = useMemo(() => {
    if (entityType !== 'amendment') return isOwnerOrCollaborator;
    return Boolean(entity?.canManageChangeRequestVotes);
  }, [entity?.canManageChangeRequestVotes, entityType, isOwnerOrCollaborator]);

  return {
    // Entity data
    entity,
    isLoading,
    error: null,

    // Editor state
    title,
    content,
    discussions,
    mode,
    modeDisabledReasons,
    selectedCrIds,

    // Save status
    saveStatus,
    hasUnsavedChanges,
    isSavingTitle,

    // Access
    hasAccess,
    isOwnerOrCollaborator,
    canVoteOnChangeRequests,
    canManageChangeRequestVotes,

    // Capabilities
    capabilities,

    // Actions
    setTitle,
    setContent,
    setDiscussions,
    setMode,
    setSelectedCrIds,
    restoreVersion: handleRestoreVersion,
  };
}
