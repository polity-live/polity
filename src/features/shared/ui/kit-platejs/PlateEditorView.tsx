import * as React from 'react';
import { Plate } from 'platejs/react';

import { SettingsDialog } from '@/features/shared/ui/kit-platejs/settings-dialog.tsx';
import { Editor, EditorContainer } from '@/features/shared/ui/ui-platejs/editor.tsx';
import { SuggestionCallbacksProvider } from '@/features/shared/ui/kit-platejs/suggestion-callbacks-context.tsx';
import { ModeProvider } from '@/features/shared/ui/kit-platejs/mode-context.tsx';
import { ModeSync } from '@/features/shared/ui/kit-platejs/mode-sync.tsx';
import { RemoteCursorsSync } from '@/features/editor/ui/RemoteCursorsSync';
import {
  editorSelectionDebugLog,
  getActiveElementDebugInfo,
  summarizeSelection,
} from '@/features/shared/logic/editorSelectionDebug';
export interface PlateEditorViewProps {
  initialValue: any;
  value: any;
  onChange: any;
  id: any;
  placeholder: any;
  containerClassName: any;
  editorClassName: any;
  containerVariant: any;
  editorVariant: any;
  currentUser: any;
  users: any;
  discussions: any;
  onDiscussionsChange: any;
  onSuggestionAccepted: any;
  onSuggestionDeclined: any;
  onVoteAccept: any;
  onVoteReject: any;
  onVoteAbstain: any;
  onFinalizeInternalVote: any;
  onEventSuggestionConfirm: any;
  onEventSuggestionCancel: any;
  documentId: any;
  documentTitle: any;
  currentMode: any;
  modeDisabledReasons: any;
  onModeChange: any;
  isOwnerOrCollaborator: any;
  readOnly: any;
  showFixedToolbar: any;
  showSettingsDialog: boolean;
  selectedCrIds: any;
  onSelectedCrIdsChange: any;
  remoteCursors: any;
  onChangeRef: any;
  isControlled: any;
  prevValueRef: any;
  initialValueRef: any;
  editorConfig: any;
  editor: any;
  hasLoadedInitialDiscussions: any;
  lastSyncedDiscussionsRef: any;
  isUpdatingFromProps: any;
  handleEditorChange: any;
}

export function PlateEditorView({
  id,
  placeholder,
  containerClassName,
  editorClassName,
  containerVariant,
  editorVariant,
  onSuggestionAccepted,
  onSuggestionDeclined,
  onVoteAccept,
  onVoteReject,
  onVoteAbstain,
  onFinalizeInternalVote,
  onEventSuggestionConfirm,
  onEventSuggestionCancel,
  documentId,
  currentMode,
  modeDisabledReasons,
  onModeChange,
  isOwnerOrCollaborator,
  readOnly,
  showSettingsDialog,
  selectedCrIds,
  onSelectedCrIdsChange,
  remoteCursors,
  editor,
  handleEditorChange,
}: PlateEditorViewProps) {
  const handleEditorFocus = React.useCallback(() => {
    editorSelectionDebugLog('editor-focus', {
      activeElement: getActiveElementDebugInfo(),
      documentId,
      selectionAtFocus: summarizeSelection(editor?.selection),
    });
  }, [documentId, editor]);

  return (
    <ModeProvider
      currentMode={currentMode}
      modeDisabledReasons={modeDisabledReasons}
      onModeChange={onModeChange}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      selectedCrIds={selectedCrIds}
      onSelectedCrIdsChange={onSelectedCrIdsChange}
    >
      <SuggestionCallbacksProvider
        callbacks={{
          onSuggestionAccepted,
          onSuggestionDeclined,
          onVoteAccept,
          onVoteReject,
          onVoteAbstain,
          onFinalizeInternalVote,
          onEventSuggestionConfirm,
          onEventSuggestionCancel,
        }}
      >
        <Plate editor={editor} onChange={handleEditorChange} readOnly={readOnly}>
          {/* Sync external mode with PlateJS internal state */}
          <ModeSync currentMode={currentMode} readOnly={readOnly} />

          {/* Sync remote cursors via Supabase Realtime */}
          {remoteCursors?.enabled && (
            <RemoteCursorsSync
              entityId={remoteCursors.entityId}
              userId={remoteCursors.userId}
              userName={remoteCursors.userName}
              userColor={remoteCursors.userColor}
              enabled={remoteCursors.enabled}
              onActiveCursorsChange={remoteCursors.onActiveCursorsChange}
            />
          )}

          <EditorContainer
            variant={containerVariant}
            className={containerClassName}
            data-swipe-lock
          >
            <Editor
              id={id}
              variant={editorVariant}
              placeholder={placeholder}
              className={editorClassName}
              onFocus={handleEditorFocus}
            />
          </EditorContainer>

          {showSettingsDialog && <SettingsDialog />}
        </Plate>
      </SuggestionCallbacksProvider>
    </ModeProvider>
  );
}
