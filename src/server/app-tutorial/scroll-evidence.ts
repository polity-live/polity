interface HorizontalScrollEvidence {
  type?: string;
  scrollPixels?: number;
  scrollRangePixels?: number;
  desktopAcknowledged?: boolean;
}

export function requiredHorizontalScrollPixels(minimumPixels: number, scrollRangePixels?: number) {
  if (
    scrollRangePixels === undefined ||
    !Number.isFinite(scrollRangePixels) ||
    scrollRangePixels <= 0
  ) {
    return minimumPixels;
  }
  return Math.min(minimumPixels, scrollRangePixels);
}

export function horizontalScrollEvidenceIsValid(
  minimumPixels: number,
  evidence: HorizontalScrollEvidence
) {
  if (evidence.desktopAcknowledged) return true;
  if (evidence.type !== 'scroll') return false;
  return (
    (evidence.scrollPixels ?? 0) >=
    requiredHorizontalScrollPixels(minimumPixels, evidence.scrollRangePixels)
  );
}
