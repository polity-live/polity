'use client';

/**
 * Inline Amendment Editor
 *
 * A compact interactive editor for embedding in CR card previews.
 * Uses useEditor internally for state management and persistence.
 * Renders PlateEditor in suggest_event mode with the toolbar.
 */

import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { PlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
import { SuggestionViewToggle } from './SuggestionViewToggle';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
export interface InlineAmendmentEditorViewProps {
  amendmentId: any;
  userId: any;
  userRecord: any;
  agendaItemId: any;
  editingMode?: EditingMode | null;
  resolvedMode: any;
  entity: any;
  isLoading: any;
  content: any;
  discussions: any;
  mode: any;
  selectedCrIds: any;
  setContent: any;
  setDiscussions: any;
  setSelectedCrIds: any;
  contentEntityId: any;
  amendmentIdFromEntity: any;
  editorOps: any;
  currentUser: any;
  editorUsers: any;
  handleChangeRequestCreate: any;
  onSuggestionAccepted: any;
  onSuggestionDeclined: any;
  onEventSuggestionConfirm: any;
  onEventSuggestionCancel: any;
}

export function InlineAmendmentEditorView({
  resolvedMode,
  entity,
  isLoading,
  content,
  discussions,
  selectedCrIds,
  setContent,
  setDiscussions,
  setSelectedCrIds,
  contentEntityId,
  currentUser,
  editorUsers,
  onSuggestionAccepted,
  onSuggestionDeclined,
  onEventSuggestionConfirm,
  onEventSuggestionCancel,
}: InlineAmendmentEditorViewProps) {
  if (isLoading) {
    return <SectionSkeleton rows={2} density="compact" />;
  }

  if (!entity) return null;

  return (
    <div className="space-y-2">
      {discussions.length > 0 && (
        <SuggestionViewToggle
          discussions={discussions}
          selectedCrIds={selectedCrIds}
          onSelectedCrIdsChange={setSelectedCrIds}
        />
      )}
      <div className="bg-background rounded-lg border">
        <PlateEditor
          key={contentEntityId}
          value={content}
          onChange={setContent}
          documentId={contentEntityId}
          currentMode={resolvedMode}
          isOwnerOrCollaborator={true}
          currentUser={
            currentUser
              ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatarUrl }
              : undefined
          }
          users={editorUsers}
          discussions={discussions}
          onDiscussionsChange={setDiscussions}
          onSuggestionAccepted={onSuggestionAccepted}
          onSuggestionDeclined={onSuggestionDeclined}
          onEventSuggestionConfirm={onEventSuggestionConfirm}
          onEventSuggestionCancel={onEventSuggestionCancel}
          selectedCrIds={selectedCrIds}
          onSelectedCrIdsChange={setSelectedCrIds}
          datasetContext={{
            defaultGroupId: entity.metadata?.groupId ?? null,
            defaultGroupName: entity.metadata?.groupName ?? null,
            canViewDatasets: entity.metadata?.canViewDatasets ?? false,
            canManageDatasets: entity.metadata?.canManageDatasets ?? false,
            canUploadDatasets: true,
          }}
        />
      </div>
    </div>
  );
}
