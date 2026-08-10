import { useState, type ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

function normalizeValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function useCreateDescriptorFieldState({
  value,
  hint,
  required,
  validator,
}: {
  value: string | number | null | undefined;
  hint?: ReactNode;
  required?: boolean;
  validator?: (value: string) => string | null;
}) {
  const { t } = useTranslation();
  const [hasInteracted, setHasInteracted] = useState(false);
  const normalizedValue = normalizeValue(value);
  const trimmedValue = normalizedValue.trim();
  const hasValue = trimmedValue.length > 0;
  const validationError = validator?.(normalizedValue) ?? null;
  const isInvalid =
    hasInteracted && ((Boolean(required) && !hasValue) || (hasValue && Boolean(validationError)));
  const isValid = (hasInteracted || hasValue) && hasValue && !validationError;
  const fallbackHint =
    hint ??
    (required ? t('pages.create.common.requiredHint') : t('pages.create.common.optionalHint'));
  const hintText = isInvalid
    ? Boolean(required) && !hasValue
      ? t('pages.create.common.requiredHint')
      : validationError
    : isValid && !hint
      ? t('pages.create.common.validHint')
      : fallbackHint;

  return {
    hintText,
    isInvalid,
    isValid,
    markInteracted: () => setHasInteracted(true),
  };
}
