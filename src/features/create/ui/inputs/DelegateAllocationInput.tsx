import { ChoiceCardField, FormControlInput } from '@/features/shared/ui/form';
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
      <ChoiceCardField
        id="allocation"
        label={t('pages.create.event.delegateAllocation')}
        value={value.allocationMode}
        onValueChange={allocationMode => update({ allocationMode })}
        options={[
          {
            value: 'ratio',
            label: t('pages.create.event.delegateAllocationMode.ratio'),
            description: t('pages.create.event.delegateAllocationMode.ratioDesc'),
            content:
              value.allocationMode === 'ratio' ? (
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
              ) : null,
          },
          {
            value: 'total',
            label: t('pages.create.event.delegateAllocationMode.total'),
            description: t('pages.create.event.delegateAllocationMode.totalDesc'),
            content:
              value.allocationMode === 'total' ? (
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
              ) : null,
          },
        ]}
      />
    </div>
  );
}
