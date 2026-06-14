import { useState } from 'react';
import type { ReactNode } from 'react';

type FieldValidator = (value: string) => string | null;

function normalizeValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

interface UseValidatedFieldControllerOptions {
  description?: ReactNode;
  required?: boolean;
  validator?: FieldValidator;
  value: string | number | null | undefined;
}

export function useValidatedFieldController({
  description,
  required,
  validator,
  value,
}: UseValidatedFieldControllerOptions) {
  const [touched, setTouched] = useState(false);
  const normalizedValue = normalizeValue(value);
  const trimmedValue = normalizedValue.trim();
  const validationError = validator?.(normalizedValue) ?? null;
  const error =
    touched && required && trimmedValue.length === 0
      ? description
      : touched && trimmedValue.length > 0
        ? validationError
        : null;
  const isValid =
    (touched || trimmedValue.length > 0) && trimmedValue.length > 0 && !validationError;

  return {
    normalizedValue,
    error,
    isValid,
    markTouched: () => setTouched(true),
  };
}
