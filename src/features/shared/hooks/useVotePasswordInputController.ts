import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVotePasswordInputControllerOptions {
  onSubmit: (password: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

const emptyDigits = () => ['', '', '', ''];

export function useVotePasswordInputController({
  onSubmit,
  error,
  isLoading,
}: UseVotePasswordInputControllerOptions) {
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      setDigits(emptyDigits());
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

        if (digit && index === 3 && next.every(digitValue => digitValue !== '')) {
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
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
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

  return {
    digits,
    inputRefs,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
  };
}
