type TranslationObject = Record<string, unknown>;

export function mergeTranslations<
  const Base extends TranslationObject,
  const Override extends TranslationObject,
>(base: Base, override: Override): Base & Override {
  const result: TranslationObject = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (
      baseValue &&
      value &&
      typeof baseValue === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(value)
    ) {
      result[key] = mergeTranslations(baseValue as TranslationObject, value as TranslationObject);
    } else {
      result[key] = value;
    }
  }

  return result as Base & Override;
}
