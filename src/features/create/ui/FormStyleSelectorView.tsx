import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Columns2, LayoutList, Smartphone } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import type { CreateFormStyle } from '@/zero/preferences/schema';

const STYLE_OPTIONS: { value: CreateFormStyle; icon: typeof Columns2; labelKey: string }[] = [
  { value: 'carousel', icon: Smartphone, labelKey: 'pages.create.preferences.carousel' },
  { value: 'one_page', icon: LayoutList, labelKey: 'pages.create.preferences.onePage' },
  { value: 'auto', icon: Columns2, labelKey: 'pages.create.preferences.auto' },
];

interface FormStyleSelectorViewProps {
  selectedFormStyle: CreateFormStyle;
  onStyleChange: (style: CreateFormStyle) => void;
}

export function FormStyleSelectorView({
  selectedFormStyle,
  onStyleChange,
}: FormStyleSelectorViewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      {STYLE_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 gap-1 px-2 text-xs',
            selectedFormStyle === value && 'bg-accent text-accent-foreground'
          )}
          onClick={() => onStyleChange(value)}
          title={t(labelKey)}
          data-create-action="set-form-style"
          data-create-option={value}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </Button>
      ))}
    </div>
  );
}
