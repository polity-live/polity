import { Download } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';

export interface CalendarExportButtonProps {
  onExport: () => void;
  label?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  'data-action-id'?: string;
}

export function CalendarExportButton({
  onExport,
  label,
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
      size={size}
      onClick={onExport}
      disabled={disabled}
      className={className}
      data-action-id={dataActionId}
    >
      <Download className="mr-2 h-4 w-4" />
      {label ?? t('features.calendar.actions.export')}
    </Button>
  );
}
