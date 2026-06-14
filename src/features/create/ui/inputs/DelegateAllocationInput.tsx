import {
  FormControlLabel,
  FormControlInput,
  FormControlRadioGroup,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';

type AllocationMode = 'ratio' | 'total';

export interface DelegateConfig {
  allocationMode: AllocationMode;
  totalDelegates: number;
  delegateRatio: number;
}

interface DelegateAllocationInputProps {
  value: DelegateConfig;
  onChange: (config: DelegateConfig) => void;
}

export function DelegateAllocationInput({ value, onChange }: DelegateAllocationInputProps) {
  const { t } = useTranslation();

  const update = (patch: Partial<DelegateConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <FormControlLabel>{t('pages.create.event.delegateAllocation')}</FormControlLabel>
      <FormControlRadioGroup
        value={value.allocationMode}
        onValueChange={v => update({ allocationMode: v as AllocationMode })}
      >
        <div className="space-y-2">
          <FormControlLabel
            htmlFor="allocation-ratio"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              value.allocationMode === 'ratio' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
          >
            <FormControlRadioGroupItem value="ratio" id="allocation-ratio" className="mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {t('pages.create.event.delegateAllocationMode.ratio')}
              </div>
              <div className="text-muted-foreground text-xs">
                {t('pages.create.event.delegateAllocationMode.ratioDesc')}
              </div>
              {value.allocationMode === 'ratio' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs">
                    {t('pages.create.event.delegateAllocationMode.ratioLabel')}
                  </span>
                  <FormControlInput
                    type="number"
                    min={1}
                    className="w-20"
                    value={value.delegateRatio}
                    onChange={e => update({ delegateRatio: parseInt(e.target.value) || 1 })}
                  />
                  <span className="text-xs">
                    {t('pages.create.event.delegateAllocationMode.ratioMembers')}
                  </span>
                </div>
              )}
            </div>
          </FormControlLabel>

          <FormControlLabel
            htmlFor="allocation-total"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              value.allocationMode === 'total' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
          >
            <FormControlRadioGroupItem value="total" id="allocation-total" className="mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {t('pages.create.event.delegateAllocationMode.total')}
              </div>
              <div className="text-muted-foreground text-xs">
                {t('pages.create.event.delegateAllocationMode.totalDesc')}
              </div>
              {value.allocationMode === 'total' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs">
                    {t('pages.create.event.delegateAllocationMode.totalLabel')}
                  </span>
                  <FormControlInput
                    type="number"
                    min={1}
                    className="w-20"
                    value={value.totalDelegates}
                    onChange={e => update({ totalDelegates: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}
            </div>
          </FormControlLabel>
        </div>
      </FormControlRadioGroup>
    </div>
  );
}
