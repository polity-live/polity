import type { ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Switch } from '@/features/shared/ui/ui/switch';
import { cn } from '@/features/shared/utils/utils';

interface SwitchFieldProps {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchFieldProps) {
  return (
    <FormFieldShell id={id} className={className}>
      {({ id: fieldId, describedBy }) => (
        <label
          htmlFor={fieldId}
          className={cn(
            'flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 transition-colors',
            checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <span className="grid gap-1">
            <span className="text-sm leading-none font-medium">{label}</span>
            {description ? (
              <span className="text-muted-foreground text-sm">{description}</span>
            ) : null}
          </span>
          <Switch
            id={fieldId}
            checked={checked}
            disabled={disabled}
            aria-describedby={describedBy}
            onCheckedChange={onCheckedChange}
          />
        </label>
      )}
    </FormFieldShell>
  );
}
