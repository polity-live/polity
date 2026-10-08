import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/features/shared/ui/ui/input';
import { useTranslation } from '@/features/shared/hooks/use-translation';

/** Apply valid values live while preserving the user's unfinished text and caret. */
export function CityDesignNumberInput({
  value,
  onCommit,
  min,
  max,
  onFocus,
  onEditEnd,
  disabled,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'> & {
  value: number | string;
  onCommit: (value: number) => void;
  onEditEnd?: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  const lastEmitted = useRef<number | null>(null);
  const errorId = useId();
  useEffect(() => {
    if (disabled) focused.current = false;
    if (!focused.current) {
      setDraft(String(value));
      setInvalid(false);
    }
    lastEmitted.current = null;
  }, [value, disabled]);
  const parse = (text: string) => {
    const normalized = text.trim().replace(',', '.');
    // A trailing separator, sign or empty field is an unfinished edit, never zero.
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
    const parsed = Number(normalized);
    if (
      !Number.isFinite(parsed) ||
      (min != null && parsed < Number(min)) ||
      (max != null && parsed > Number(max))
    ) {
      return null;
    }
    return parsed;
  };
  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        min={min}
        max={max}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={
          invalid
            ? [props['aria-describedby'], errorId].filter(Boolean).join(' ')
            : props['aria-describedby']
        }
        onFocus={event => {
          focused.current = true;
          onFocus?.(event);
        }}
        onChange={event => {
          if (disabled) return;
          const text = event.target.value;
          setDraft(text);
          setInvalid(false);
          const parsed = parse(text);
          if (parsed != null && parsed !== Number(value) && parsed !== lastEmitted.current) {
            lastEmitted.current = parsed;
            onCommit(parsed);
          }
        }}
        onBlur={() => {
          focused.current = false;
          if (parse(draft) == null) setInvalid(true);
          else {
            setDraft(String(value));
            setInvalid(false);
          }
          lastEmitted.current = null;
          onEditEnd?.();
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
            setDraft(String(value));
            setInvalid(false);
          }
        }}
      />
      {invalid && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {t('features.amendments.cityDesign.inspector.invalidValue')}
        </p>
      )}
    </>
  );
}
