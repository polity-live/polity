import { FormControlLabel } from '@/features/shared/ui/form';
import { Switch } from '@/features/shared/ui/ui/switch';
import { cn } from '@/features/shared/utils/utils';

interface StatementStoryToggleProps {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function StatementStoryToggle({
  checked,
  description,
  label,
  onCheckedChange,
  className,
}: StatementStoryToggleProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg border p-4', className)}>
      <div className="space-y-1">
        <FormControlLabel className="text-base font-semibold">{label}</FormControlLabel>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch
        data-action-id="create.statement-story.toggle"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
