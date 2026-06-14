import { Search, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface SearchFieldProps extends Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> {
  value: string;
  onValueChange: (value: string) => void;
  label?: ReactNode;
  description?: ReactNode;
  clearLabel?: string;
  fieldClassName?: string;
}

export function SearchField({
  value,
  onValueChange,
  label,
  description,
  clearLabel = 'Clear search',
  fieldClassName,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <FormFieldShell label={label} description={description} className={fieldClassName}>
      {({ id, describedBy }) => (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            {...props}
            id={id}
            type="search"
            value={value}
            aria-describedby={describedBy}
            onChange={event => onValueChange(event.target.value)}
            className={cn('pr-9 pl-9', className)}
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              onClick={() => onValueChange('')}
            >
              <X className="size-4" />
              <span className="sr-only">{clearLabel}</span>
            </Button>
          ) : null}
        </div>
      )}
    </FormFieldShell>
  );
}
