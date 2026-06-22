import { BadgeControl } from '@/features/shared/ui/status';
import { ChoiceCardField } from '@/features/shared/ui/form';
import { type ReactNode } from 'react';
import { getElectionModeLabel, type ElectionMode } from '@/features/elections/logic/electionMode';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ElectionModeInputProps {
  value: ElectionMode;
  onChange: (value: ElectionMode) => void;
  label?: string;
  hint?: string;
  className?: string;
  descriptions?: Partial<Record<ElectionMode, ReactNode>>;
}

export function ElectionModeInput({
  value,
  onChange,
  label = translateText('features.elections.mode.typeLabel'),
  hint,
  className,
  descriptions,
}: ElectionModeInputProps) {
  return (
    <ChoiceCardField
      label={label}
      description={hint}
      value={value}
      onValueChange={onChange}
      grid="two"
      className={className}
      options={(['list', 'single'] as ElectionMode[]).map(mode => ({
        value: mode,
        label: getElectionModeLabel(mode),
        description: descriptions?.[mode],
        suffix: (
          <BadgeControl variant={value === mode ? 'default' : 'outline'}>
            {value === mode
              ? translateText('generated.inline.0067_aktiv_16a766ca')
              : translateText('generated.inline.0068_waehlen_ef754cb8')}
          </BadgeControl>
        ),
      }))}
    />
  );
}
