'use client';

import { ChoiceCardField } from '@/features/shared/ui/form';
import type { BallotVisibility } from '@/zero/shared';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface BallotVisibilityInputProps {
  value: BallotVisibility;
  onChange: (value: BallotVisibility) => void;
  label?: string;
  hint?: string;
}

export function BallotVisibilityInput({
  value,
  onChange,
  label = translateText('features.agendas.ballotVisibility.label'),
  hint = translateText(
    'generated.inline.0005_geheime_abstimmungen_bleiben_aggregiert_namen_d12f972e'
  ),
}: BallotVisibilityInputProps) {
  return (
    <ChoiceCardField
      id="ballot-visibility"
      label={label}
      description={hint}
      value={value}
      onValueChange={onChange}
      grid="two"
      options={[
        {
          value: 'secret',
          label: translateText('generated.inline.0016_geheim_4d376b70'),
          description: translateText(
            'generated.inline.0017_nur_aggregierte_ergebnisse_keine_zuordnung_zu_6e6175d4'
          ),
        },
        {
          value: 'named',
          label: translateText('generated.inline.0013_namentlich_8d49da42'),
          description: translateText(
            'generated.inline.0018_einzelstimmen_koennen_im_agenda_detail_live_n_42b49588'
          ),
        },
      ]}
    />
  );
}
