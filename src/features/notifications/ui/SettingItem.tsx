import { Label } from '@/features/shared/ui/ui/label';
import { Switch } from '@/features/shared/ui/ui/switch';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface SettingItemProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  adminOnly?: boolean;
}

export function SettingItem({
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
        <Label className="text-sm font-medium">
          {label}
          {adminOnly && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t('pages.notifications.settingsPage.adminOnly')}
            </span>
          )}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
