import type { ComponentType, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { cn } from '@/features/shared/utils/utils';

export type ChoiceCardGrid = 'stack' | 'two' | 'three' | 'four';

export interface ChoiceCardOption<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  content?: ReactNode;
  suffix?: ReactNode;
}

interface ChoiceCardFieldProps<TValue extends string = string> {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: readonly ChoiceCardOption<TValue>[];
  grid?: ChoiceCardGrid;
  className?: string;
}

const gridClasses: Record<ChoiceCardGrid, string> = {
  stack: 'grid gap-2',
  two: 'grid gap-3 md:grid-cols-2',
  three: 'grid gap-2 sm:grid-cols-3',
  four: 'grid grid-cols-2 gap-2 sm:grid-cols-4',
};

export function ChoiceCardField<TValue extends string = string>({
  id,
  label,
  description,
  error,
  invalid,
  required,
  value,
  onValueChange,
  options,
  grid = 'stack',
  className,
}: ChoiceCardFieldProps<TValue>) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      invalid={invalid}
      required={required}
      className={className}
    >
      {({ describedBy, invalid }) => (
        <RadioGroup
          value={value}
          onValueChange={nextValue => onValueChange(nextValue as TValue)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={gridClasses[grid]}
        >
          {options.map(option => {
            const optionId = `${id ?? 'choice-card'}-${option.value}`;
            const Icon = option.icon;
            const selected = option.value === value;

            return (
              <label
                key={option.value}
                htmlFor={optionId}
                data-create-option={option.value}
                className={cn(
                  'border-input flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
                  selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/50',
                  option.disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <RadioGroupItem
                  id={optionId}
                  value={option.value}
                  disabled={option.disabled}
                  data-create-option={option.value}
                  className="mt-0.5"
                />
                {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="text-muted-foreground block text-xs">
                      {option.description}
                    </span>
                  ) : null}
                  {option.content ? <span className="block">{option.content}</span> : null}
                </span>
                {option.suffix ? <span className="shrink-0">{option.suffix}</span> : null}
              </label>
            );
          })}
        </RadioGroup>
      )}
    </FormFieldShell>
  );
}
