import { FormControlLabel, FormControlSwitch } from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface SettingItemProps {
  'data-action-id': string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  adminOnly?: boolean;
}

export function SettingItem({
  'data-action-id': actionId,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  adminOnly,
}: SettingItemProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between space-x-4 py-3">
      <div className="flex-1 space-y-0.5">
        <FormControlLabel className="text-sm font-medium">
          {label}
          {adminOnly && (
            <span className="bg-muted text-muted-foreground ml-2 rounded-md px-2 py-0.5 text-xs">
              {t('pages.notifications.settingsPage.adminOnly')}
            </span>
          )}
        </FormControlLabel>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <FormControlSwitch
        data-action-id={actionId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
