'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FormControlInput } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';

export interface VotePasswordInputProps {
  onSubmit: (password: string) => void;
  error?: string | null;
  isLoading?: boolean;
  className?: string;
}

export function VotePasswordInput({
  onSubmit,
  error,
  isLoading,
  className,
}: VotePasswordInputProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      setDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  }, [error]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (isLoading) return;

      const digit = value.replace(/\D/g, '').slice(-1);

      setDigits(prev => {
        const next = [...prev];
        next[index] = digit;

        if (digit && index === 3 && next.every(d => d !== '')) {
          setTimeout(() => onSubmit(next.join('')), 0);
        }

        return next;
      });

      if (digit && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [isLoading, onSubmit]
  );

  const handleKeyDown = useCallback(
    (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      if (isLoading) return;

      const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
      if (pasted.length === 0) return;

      const newDigits = [...digits];
      for (let index = 0; index < pasted.length; index++) {
        newDigits[index] = pasted[index];
      }
      setDigits(newDigits);

      if (pasted.length === 4) {
        setTimeout(() => onSubmit(newDigits.join('')), 0);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [digits, isLoading, onSubmit]
  );

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-muted-foreground text-center text-sm">
        {t('features.events.voting.enterPin')}
      </p>
      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <FormControlInput
            key={index}
            ref={element => {
              inputRefs.current[index] = element;
            }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={event => handleChange(index, event.target.value)}
            onKeyDown={event => handleKeyDown(index, event)}
            disabled={isLoading}
            className={cn('h-14 w-14 text-center text-2xl', error && 'border-destructive')}
            autoComplete="off"
          />
        ))}
      </div>
      {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}
    </div>
  );
}
