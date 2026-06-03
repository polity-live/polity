import { useCallback, useState } from 'react';
import {
  applyNetworkLinkPreset,
  buildNetworkLinkComposerDefaults,
} from '../logic/networkLinkComposer';
import type {
  NetworkLinkComposerTab,
  NetworkLinkComposerValue,
  NetworkLinkPreset,
} from '../types/network.types';

export function useNetworkLinkComposer(initialValue?: Partial<NetworkLinkComposerValue>) {
  const [activeTab, setActiveTab] = useState<NetworkLinkComposerTab>('preset');
  const [value, setValue] = useState<NetworkLinkComposerValue>(() => ({
    ...buildNetworkLinkComposerDefaults(),
    ...initialValue,
  }));

  const updateValue = useCallback((nextValue: Partial<NetworkLinkComposerValue>) => {
    setValue(currentValue => ({
      ...currentValue,
      ...nextValue,
    }));
  }, []);

  const selectPreset = useCallback((preset: NetworkLinkPreset) => {
    setValue(currentValue => applyNetworkLinkPreset(preset, currentValue));
  }, []);

  const resetComposer = useCallback((nextValue?: Partial<NetworkLinkComposerValue>) => {
    setValue({
      ...buildNetworkLinkComposerDefaults(),
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
