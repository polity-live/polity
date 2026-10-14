export function parseDatasetNumber(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) return Number.NaN;

  const withoutPercent = normalized.replace(/%$/, '').trim();
  const withoutSpaces = withoutPercent.replace(/\s+/g, '');
  const commaCount = (withoutSpaces.match(/,/g) ?? []).length;
  const dotCount = (withoutSpaces.match(/\./g) ?? []).length;
  let numericText = withoutSpaces;

  if (commaCount > 0 && dotCount > 0) {
    numericText =
      withoutSpaces.lastIndexOf(',') > withoutSpaces.lastIndexOf('.')
        ? withoutSpaces.replace(/\./g, '').replace(',', '.')
        : withoutSpaces.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    numericText = withoutSpaces.replace(',', '.');
  } else if (commaCount > 1 && dotCount === 0) {
    numericText = withoutSpaces.replace(/,/g, '');
  }

  return Number(numericText);
}
