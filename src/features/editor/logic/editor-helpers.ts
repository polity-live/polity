import { featureThemeGeneratedHsl } from '@/features/shared/theme';

const DISTINCT_COLOR_HUE_STEP = 137;
const DISTINCT_COLOR_SATURATIONS = [70, 64, 76, 58, 82] as const;
const DISTINCT_COLOR_LIGHTNESSES = [50, 46, 54, 42, 58] as const;

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * Generate a consistent color for a user based on their ID
 */
export function generateUserColor(userId: string): string {
  const hash = hashString(userId);
  const hue = hash % 360;
  return featureThemeGeneratedHsl(hue);
}

function generateUserColorVariant(userId: string, attempt: number): string {
  if (attempt === 0) {
    return generateUserColor(userId);
  }

  const hash = hashString(userId);
  const hue = (hash + attempt * DISTINCT_COLOR_HUE_STEP) % 360;
  const saturation = DISTINCT_COLOR_SATURATIONS[attempt % DISTINCT_COLOR_SATURATIONS.length];
  const lightness =
    DISTINCT_COLOR_LIGHTNESSES[
      Math.floor(attempt / DISTINCT_COLOR_SATURATIONS.length) % DISTINCT_COLOR_LIGHTNESSES.length
    ];

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate deterministic, collision-free user colors for one visible editor roster.
 */
export function generateDistinctUserColorMap(
  userIds: Iterable<string | null | undefined>
): Map<string, string> {
  const uniqueUserIds = Array.from(
    new Set(Array.from(userIds).filter((userId): userId is string => Boolean(userId)))
  ).sort();

  const usedColors = new Set<string>();
  const colorByUserId = new Map<string, string>();

  for (const userId of uniqueUserIds) {
    let attempt = 0;
    let color = generateUserColorVariant(userId, attempt);

    while (usedColors.has(color)) {
      attempt += 1;
      color = generateUserColorVariant(userId, attempt);
    }

    usedColors.add(color);
    colorByUserId.set(userId, color);
  }

  return colorByUserId;
}
