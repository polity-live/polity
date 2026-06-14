import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { type ReactNode } from 'react';
import { getElectionModeLabel, type ElectionMode } from '@/features/elections/logic/electionMode';
import { cn } from '@/features/shared/utils/utils';
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
  label = 'Wahltyp',
  hint,
  className,
  descriptions,
}: ElectionModeInputProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <FormControlLabel>{label}</FormControlLabel>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(['list', 'single'] as ElectionMode[]).map(mode => (
          <Button
            key={mode}
            type="button"
            variant="outline"
            onClick={() => onChange(mode)}
            className={cn(
              'h-auto justify-start rounded-2xl p-4 text-left whitespace-normal transition-all',
              value === mode
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">{getElectionModeLabel(mode)}</p>
                {descriptions?.[mode] ? (
                  <div className="text-muted-foreground text-sm">{descriptions[mode]}</div>
                ) : null}
              </div>
              <BadgeControl variant={value === mode ? 'default' : 'outline'}>
                {value === mode
                  ? translateText('generated.inline.0067_aktiv_16a766ca')
                  : translateText('generated.inline.0068_waehlen_ef754cb8')}
              </BadgeControl>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
