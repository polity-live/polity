import { DelegateAllocationInput, type DelegateConfig } from './DelegateAllocationInput';
import { ElectionModeInput } from '@/features/elections/ui/ElectionModeInput';
import type { ElectionMode } from '@/features/elections/logic/electionMode';

interface EventDelegateAllocationSettingsInputProps {
  delegateConfig: DelegateConfig;
  delegateElectionMode: ElectionMode;
  electionModeLabel: string;
  electionModeHint: string;
  electionModeDescriptions: {
    list: string;
    single: string;
  };
  onDelegateConfigChange: (value: DelegateConfig) => void;
  onDelegateElectionModeChange: (value: ElectionMode) => void;
}

export function EventDelegateAllocationSettingsInput({
  delegateConfig,
  delegateElectionMode,
  electionModeLabel,
  electionModeHint,
  electionModeDescriptions,
  onDelegateConfigChange,
  onDelegateElectionModeChange,
}: EventDelegateAllocationSettingsInputProps) {
  return (
    <div className="space-y-4">
      <DelegateAllocationInput value={delegateConfig} onChange={onDelegateConfigChange} />
      <ElectionModeInput
        value={delegateElectionMode}
        onChange={onDelegateElectionModeChange}
        label={electionModeLabel}
        hint={electionModeHint}
        descriptions={electionModeDescriptions}
      />
    </div>
  );
}
