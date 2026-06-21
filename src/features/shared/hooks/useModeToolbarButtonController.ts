import { useEffect, useMemo, useState } from 'react';

import { SuggestionPlugin } from '@platejs/suggestion/react';
import { useEditorRef, usePlateState, usePluginOption } from 'platejs/react';

import type { EditorMode } from '@/features/editor/types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getEditingModeOption, type SelectableEditingMode } from '@/features/shared/ui/status';

interface UseModeToolbarButtonControllerOptions {
  currentMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void | Promise<void>;
}

export function useModeToolbarButtonController({
  currentMode,
  onModeChange,
}: UseModeToolbarButtonControllerOptions) {
  const editor = useEditorRef();
  const [readOnly, setReadOnly] = usePlateState('readOnly');
  const [open, setOpen] = useState(false);
  const isSuggesting = usePluginOption(SuggestionPlugin, 'isSuggesting');
  const { t } = useTranslation();

  const syncedMode = useMemo<SelectableEditingMode>(() => {
    if (currentMode) {
      return currentMode;
    }

    if (readOnly) return 'view';
    if (isSuggesting) return 'suggest_internal';

    return 'edit';
  }, [currentMode, isSuggesting, readOnly]);

  const [mode, setMode] = useState<SelectableEditingMode>(syncedMode);
  const [pendingMode, setPendingMode] = useState<SelectableEditingMode | null>(null);

  useEffect(() => {
    if (pendingMode) {
      if (syncedMode === pendingMode) {
        setPendingMode(null);
        setMode(syncedMode);
      }
      return;
    }

    setMode(syncedMode);
  }, [pendingMode, syncedMode]);

  const currentOption = getEditingModeOption(mode, t);

  const handleModeChange = async (nextMode: SelectableEditingMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);

    if (onModeChange) {
      setPendingMode(nextMode);
      try {
        await onModeChange(nextMode);
      } catch {
        setPendingMode(null);
        setMode(syncedMode);
      }
      return;
    }

    setReadOnly(
      nextMode === 'view' || nextMode === 'vote_internal' || nextMode === 'event_final_closing_vote'
    );
    editor.setOption(
      SuggestionPlugin,
      'isSuggesting',
      nextMode === 'suggest_internal' || nextMode === 'suggest_event'
    );

    if (nextMode === 'edit') {
      editor.tf.focus();
    }
  };

  return {
    open,
    onOpenChange: setOpen,
    mode,
    currentOption,
    labels: {
      editingMode: t('plateJs.toolbar.editingMode'),
      viewOnly: t('plateJs.toolbar.mode.viewOnly'),
    },
    onModeChange: handleModeChange,
  };
}
