import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';

export function PaymentEntityTypeInput({
  label,
  userLabel,
  groupLabel,
  entityType,
  onEntityTypeChange,
  onClearUser,
  onClearGroup,
}: {
  label: string;
  userLabel: string;
  groupLabel: string;
  entityType: 'user' | 'group';
  onEntityTypeChange: (type: 'user' | 'group') => void;
  onClearUser: () => void;
  onClearGroup: () => void;
}) {
  return (
    <div className="space-y-4">
      <FormControlLabel>{label}</FormControlLabel>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={entityType === 'user' ? 'default' : 'outline'}
          onClick={() => {
            onEntityTypeChange('user');
            onClearGroup();
          }}
          className="flex-1"
        >
          {userLabel}
        </Button>
        <Button
          type="button"
          variant={entityType === 'group' ? 'default' : 'outline'}
          onClick={() => {
            onEntityTypeChange('group');
            onClearUser();
          }}
          className="flex-1"
        >
          {groupLabel}
        </Button>
      </div>
    </div>
  );
}
