import type { ComponentType, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export type SegmentedChoiceTone = 'neutral' | 'success' | 'warning' | 'destructive' | 'accent';

export interface SegmentedChoiceOption<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: SegmentedChoiceTone;
  disabled?: boolean;
}

interface SegmentedChoiceFieldProps<TValue extends string = string> {
  label?: ReactNode;
  description?: ReactNode;
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: readonly SegmentedChoiceOption<TValue>[];
  className?: string;
  columns?: 'auto' | 'equal';
  size?: 'default' | 'icon';
  isOptionSelected?: (option: SegmentedChoiceOption<TValue>) => boolean;
}

const selectedToneClasses: Record<SegmentedChoiceTone, string> = {
  neutral: 'bg-muted text-foreground hover:bg-muted',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  accent: 'bg-primary text-primary-foreground hover:bg-primary/90',
};

export function SegmentedChoiceField<TValue extends string = string>({
  label,
  description,
  value,
  onValueChange,
  options,
  className,
  columns = 'equal',
  size = 'default',
  isOptionSelected,
}: SegmentedChoiceFieldProps<TValue>) {
  return (
    <FormFieldShell label={label} description={description} className={className}>
      {() => (
        <div className={cn('flex flex-wrap gap-2', columns === 'equal' && '[&>*]:flex-1')}>
          {options.map(option => {
            const Icon = option.icon;
            const selected = isOptionSelected ? isOptionSelected(option) : option.value === value;

            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? 'default' : 'outline'}
                size={size === 'icon' ? 'icon' : 'default'}
                disabled={option.disabled}
                className={cn(
                  'gap-2',
                  size === 'icon' && 'h-9 w-9 rounded-full text-xs',
                  selected && selectedToneClasses[option.tone ?? 'accent']
                )}
                onClick={() => onValueChange(option.value)}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {option.label}
              </Button>
            );
          })}
        </div>
      )}
    </FormFieldShell>
  );
}
