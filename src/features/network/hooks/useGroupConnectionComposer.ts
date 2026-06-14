import { useCallback, useState } from 'react';
import {
  applyGroupConnectionPreset,
  buildGroupConnectionComposerDefaults,
} from '../logic/groupConnectionComposer';
import type {
  GroupConnectionComposerTab,
  GroupConnectionComposerValue,
  GroupConnectionPreset,
} from '../types/network.types';

export function useGroupConnectionComposer(initialValue?: Partial<GroupConnectionComposerValue>) {
  const [activeTab, setActiveTab] = useState<GroupConnectionComposerTab>('preset');
  const [value, setValue] = useState<GroupConnectionComposerValue>(() => ({
    ...buildGroupConnectionComposerDefaults(),
    ...initialValue,
  }));

  const updateValue = useCallback((nextValue: Partial<GroupConnectionComposerValue>) => {
    setValue(currentValue => ({
      ...currentValue,
      ...nextValue,
    }));
  }, []);

  const selectPreset = useCallback((preset: GroupConnectionPreset) => {
    setValue(currentValue => applyGroupConnectionPreset(preset, currentValue));
  }, []);

  const resetComposer = useCallback((nextValue?: Partial<GroupConnectionComposerValue>) => {
    setValue({
      ...buildGroupConnectionComposerDefaults(),
      ...nextValue,
    });
    setActiveTab('preset');
  }, []);

  return {
    activeTab,
    setActiveTab,
    value,
    setValue,
    updateValue,
    selectPreset,
    resetComposer,
  };
}
