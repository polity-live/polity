import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { useCurrencyCatalog } from '@/features/shared/hooks/useCurrencyCatalog';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type { CurrencyCode } from '@/features/shared/logic/currency';

export interface CurrencySelectProps {
  'data-action-id'?: string;
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function CurrencySelect({
  'data-action-id': actionId,
  value,
  onChange,
  disabled,
  ariaLabel,
}: CurrencySelectProps) {
  const { language, t } = useTranslation();
  const currencies = useCurrencyCatalog(language);
  const [open, setOpen] = useState(false);
  const selected = currencies.find(currency => currency.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? t('pages.user.preferences.displayCurrency')}
          className="w-full justify-between"
          disabled={disabled}
          data-action-id={actionId}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('pages.user.preferences.currencySearch')} />
          <CommandList>
            <CommandEmpty>{t('pages.user.preferences.currencyEmpty')}</CommandEmpty>
            <CommandGroup>
              {currencies.map(currency => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === currency.code ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{currency.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
