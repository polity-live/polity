import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover.tsx';
import type { Language } from '@/features/shared/global-state/language.store.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils.ts';
import type { Size } from '@/features/navigation/types/navigation.types.tsx';

interface LanguageToggleViewProps {
  size: Size;
  className?: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  sideOffset: number;
  variant: 'popover' | 'dropdown';
  isLanguagePopoverOpen: boolean;
  language: Language;
  labels: {
    english: string;
    german: string;
    moreLanguages: string;
    title: string;
  };
  onLanguageChange: (language: Language, closePopover?: boolean) => void;
  onPopoverMouseLeave: () => void;
  onPopoverOpenChange: (open: boolean) => void;
  onPopoverTriggerMouseEnter: () => void;
}

function LanguageDisplay({
  lang,
  labels,
  size,
}: {
  lang: Language;
  labels: LanguageToggleViewProps['labels'];
  size: Size;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('text-base', size === 'small' && 'text-sm')}>
        {lang === 'en' ? '🇺🇸' : '🇩🇪'}
      </span>
      <span className={cn('text-sm', size === 'small' && 'text-xs')}>
        {lang === 'en' ? labels.english : labels.german}
      </span>
    </span>
  );
}

export function LanguageToggleView({
  size,
  className,
  side,
  sideOffset,
  variant,
  isLanguagePopoverOpen,
  language,
  labels,
  onLanguageChange,
  onPopoverMouseLeave,
  onPopoverOpenChange,
  onPopoverTriggerMouseEnter,
}: LanguageToggleViewProps) {
  if (variant === 'dropdown') {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <p>
            <LanguageDisplay lang={language} labels={labels} size={size} />
          </p>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onLanguageChange('en')}>
              <LanguageDisplay lang="en" labels={labels} size={size} />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLanguageChange('de')}>
              <LanguageDisplay lang="de" labels={labels} size={size} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>{labels.moreLanguages}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
  }

  return (
    <Popover open={isLanguagePopoverOpen} onOpenChange={onPopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', size === 'small' && 'h-6 w-6', className)}
          title={labels.title}
          onMouseEnter={onPopoverTriggerMouseEnter}
        >
          <span className={cn('text-sm', size === 'small' && 'text-xs')}>
            {language === 'en' ? '🇺🇸' : '🇩🇪'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-40 w-auto p-1"
        side={side}
        sideOffset={sideOffset}
        onMouseLeave={onPopoverMouseLeave}
      >
        <div className="flex flex-col gap-1">
          <Button
            variant={language === 'en' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 justify-start gap-2"
            onClick={() => onLanguageChange('en', true)}
          >
            <span className="text-base">🇺🇸</span>
            <span className="text-sm">
              {translateText('generated.inline.0755_english_649df08a')}
            </span>
          </Button>
          <Button
            variant={language === 'de' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 justify-start gap-2"
            onClick={() => onLanguageChange('de', true)}
          >
            <span className="text-base">🇩🇪</span>
            <span className="text-sm">
              {translateText('generated.inline.0756_deutsch_a6a77092')}
            </span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
