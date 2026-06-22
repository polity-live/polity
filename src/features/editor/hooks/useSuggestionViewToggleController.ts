import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { TDiscussion } from '../types';

type FilterMode = 'select' | 'choice';
interface CrOption {
  crId: string;
  displayCrId: string;
  title: string;
  userId: string;
  aliases: string[];
}

function addAlias(aliases: string[], value: string | null | undefined) {
  const normalized = value?.trim();
  if (normalized && !aliases.includes(normalized)) {
    aliases.push(normalized);
  }
}

function optionMatchesSelected(option: CrOption, selectedCrIds: Set<string> | null) {
  return Boolean(selectedCrIds && option.aliases.some(alias => selectedCrIds.has(alias)));
}

export function useSuggestionViewToggleController(args: {
  discussions: TDiscussion[];
  selectedCrIds: Set<string> | null;
  onSelectedCrIdsChange: (crIds: Set<string> | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('select');

  const crOptions = args.discussions
    .filter((discussion): discussion is TDiscussion & { crId: string } => Boolean(discussion.crId))
    .map(discussion => {
      const displayCrId = discussion.displayCrId ?? discussion.crId;
      const title = discussion.title || discussion.crId;
      const aliases: string[] = [];

      addAlias(aliases, discussion.crId);
      addAlias(aliases, displayCrId);
      addAlias(aliases, discussion.id);
      addAlias(aliases, discussion.title);
      addAlias(aliases, discussion.changeRequestEntityId);

      return {
        crId: discussion.crId,
        displayCrId,
        title,
        userId: discussion.userId,
        aliases,
      };
    });

  const selectedCrIds = args.selectedCrIds;
  const isFiltered = selectedCrIds !== null;
  const buttonLabel = (() => {
    if (!isFiltered) return t('features.editor.suggestionView.allSuggestions');
    if (selectedCrIds.size === 1) {
      const [singleCr] = selectedCrIds;
      return crOptions.find(option => option.aliases.includes(singleCr))?.displayCrId ?? singleCr;
    }
    return t('features.editor.suggestionView.nSelected', { count: selectedCrIds.size });
  })();

  const handleModeChange = (newMode: string) => {
    if (!newMode) return;
    const mode = newMode as FilterMode;
    if (mode === filterMode) return;

    if (mode === 'select' && (!args.selectedCrIds || args.selectedCrIds.size !== 1)) {
      args.onSelectedCrIdsChange(null);
    }

    setFilterMode(mode);
  };

  const handleSelectCr = (crId: string | null) => {
    args.onSelectedCrIdsChange(crId === null ? null : new Set([crId]));
    setOpen(false);
  };

  const handleToggleCr = (crId: string) => {
    const current = args.selectedCrIds ? new Set(args.selectedCrIds) : new Set<string>();
    const option = crOptions.find(candidate => candidate.crId === crId);

    if (option && optionMatchesSelected(option, current)) {
      option.aliases.forEach(alias => current.delete(alias));
    } else if (current.has(crId)) {
      current.delete(crId);
    } else {
      current.add(crId);
    }
    args.onSelectedCrIdsChange(current.size === 0 ? null : current);
  };

  const handleSelectAll = () => {
    args.onSelectedCrIdsChange(new Set(crOptions.map(option => option.crId)));
  };

  const handleDeselectAll = () => {
    args.onSelectedCrIdsChange(null);
  };

  const allSelected =
    args.selectedCrIds !== null &&
    crOptions.length > 0 &&
    crOptions.every(option => optionMatchesSelected(option, args.selectedCrIds));

  return {
    open,
    onOpenChange: setOpen,
    filterMode,
    crOptions,
    isFiltered,
    buttonLabel,
    allSelected,
    labels: {
      selectMode: t('features.editor.suggestionView.selectMode'),
      choiceMode: t('features.editor.suggestionView.choiceMode'),
      searchPlaceholder: t('features.editor.suggestionView.searchPlaceholder'),
      noResults: t('features.editor.suggestionView.noResults'),
      allSuggestions: t('features.editor.suggestionView.allSuggestions'),
      deselectAll: t('features.editor.suggestionView.deselectAll'),
      selectAll: t('features.editor.suggestionView.selectAll'),
    },
    onModeChange: handleModeChange,
    onSelectCr: handleSelectCr,
    onToggleCr: handleToggleCr,
    onSelectAll: handleSelectAll,
    onDeselectAll: handleDeselectAll,
  };
}
