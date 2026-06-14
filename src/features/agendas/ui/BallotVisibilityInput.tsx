'use client';

import type { BallotVisibility } from '@/zero/shared';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
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
  label = 'Stimmabgabe',
  hint = translateText(
    'generated.inline.0005_geheime_abstimmungen_bleiben_aggregiert_namen_d12f972e'
  ),
}: BallotVisibilityInputProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={nextValue => onChange(nextValue as BallotVisibility)}
        className="grid gap-3 md:grid-cols-2"
      >
        <label className="border-input hover:border-primary/50 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors">
          <RadioGroupItem value="secret" id="ballot-visibility-secret" className="mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">
              {translateText('generated.inline.0016_geheim_4d376b70')}
            </div>
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0017_nur_aggregierte_ergebnisse_keine_zuordnung_zu_6e6175d4'
              )}
            </p>
          </div>
        </label>

        <label className="border-input hover:border-primary/50 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors">
          <RadioGroupItem value="named" id="ballot-visibility-named" className="mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">
              {translateText('generated.inline.0013_namentlich_8d49da42')}
            </div>
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0018_einzelstimmen_koennen_im_agenda_detail_live_n_42b49588'
              )}
            </p>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}
