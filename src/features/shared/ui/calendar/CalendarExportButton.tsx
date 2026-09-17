import { Download } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';

export interface CalendarExportButtonProps {
  onExport: () => void;
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  'data-action-id'?: string;
}

export function CalendarExportButton({
  onExport,
  label,
  iconOnly = false,
  disabled = false,
  size = 'sm',
  variant = 'outline',
  className,
  'data-action-id': dataActionId,
}: CalendarExportButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? 'icon' : size}
      aria-label={iconOnly ? (label ?? t('features.calendar.actions.export')) : undefined}
      title={iconOnly ? (label ?? t('features.calendar.actions.export')) : undefined}
      onClick={onExport}
      disabled={disabled}
      className={className}
      data-action-id={dataActionId}
    >
      <Download className={iconOnly ? 'size-4' : 'mr-2 h-4 w-4'} />
      {!iconOnly ? (label ?? t('features.calendar.actions.export')) : null}
    </Button>
  );
}
