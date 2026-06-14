import { Minus, Plus } from 'lucide-react';

import { ToolbarButton } from '@/features/shared/ui/layout';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

interface FontSizeToolbarButtonViewProps {
  displayValue: string;
  fontSizes: readonly string[];
  isFocused: boolean;
  onBlur: () => void;
  onDecrease: () => void;
  onFocus: () => void;
  onIncrease: () => void;
  onInputChange: (value: string) => void;
  onInputCommit: () => void;
  onSelectFontSize: (size: string) => void;
}

export function FontSizeToolbarButtonView({
  displayValue,
  fontSizes,
  isFocused,
  onBlur,
  onDecrease,
  onFocus,
  onIncrease,
  onInputChange,
  onInputCommit,
  onSelectFontSize,
}: FontSizeToolbarButtonViewProps) {
  return (
    <div className="bg-muted/60 flex h-7 items-center gap-1 rounded-md p-0">
      <ToolbarButton onClick={onDecrease}>
        <Minus />
      </ToolbarButton>

      <Popover open={isFocused} modal={false}>
        <PopoverTrigger asChild>
          <input
            className={cn(
              'hover:bg-muted h-full w-10 shrink-0 bg-transparent px-1 text-center text-sm'
            )}
            value={displayValue}
            onBlur={onBlur}
            onChange={event => onInputChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onInputCommit();
              }
            }}
            data-plate-focus="true"
            type="text"
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-10 px-px py-1"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          {fontSizes.map((size: any) => (
            <button
              key={size}
              className={cn(
                'hover:bg-accent data-[highlighted=true]:bg-accent flex h-8 w-full items-center justify-center text-sm'
              )}
              onClick={() => onSelectFontSize(size)}
              data-highlighted={size === displayValue}
              type="button"
            >
              {size}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <ToolbarButton onClick={onIncrease}>
        <Plus />
      </ToolbarButton>
    </div>
  );
}
