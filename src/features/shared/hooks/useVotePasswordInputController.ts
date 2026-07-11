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
  const digitsRef = useRef<string[]>(emptyDigits());
  const scheduledPinRef = useRef<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const replaceDigits = useCallback((next: string[]) => {
    digitsRef.current = next;
    setDigits(next);
  }, []);

  const scheduleSubmit = useCallback(
    (pin: string) => {
      if (scheduledPinRef.current === pin) return;
      scheduledPinRef.current = pin;
      setTimeout(() => onSubmit(pin), 0);
    },
    [onSubmit]
  );

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      scheduledPinRef.current = null;
      replaceDigits(emptyDigits());
      inputRefs.current[0]?.focus();
    }
  }, [error, replaceDigits]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (isLoading) return;

      const digit = value.replace(/\D/g, '').slice(-1);

      const next = [...digitsRef.current];
      next[index] = digit;
      replaceDigits(next);

      if (digit && index === 3 && next.every(digitValue => digitValue !== '')) {
        scheduleSubmit(next.join(''));
      }

      if (digit && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [isLoading, replaceDigits, scheduleSubmit]
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

      const newDigits = [...digitsRef.current];
      for (let index = 0; index < pasted.length; index++) {
        newDigits[index] = pasted[index];
      }
      replaceDigits(newDigits);

      if (pasted.length === 4) {
        scheduleSubmit(newDigits.join(''));
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [isLoading, replaceDigits, scheduleSubmit]
  );

  return {
    digits,
    inputRefs,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
  };
}
