import { featureThemeClassName } from '@/features/shared/theme';
// Helper function to get appropriate styling based on amendment status
export function getStatusStyles(status: string) {
  switch (status) {
    case 'Passed':
    case 'passed':
      return {
        badge: 'primary',
        bgColor: featureThemeClassName('userUserWikiSuccessGradientSurface'),
        textColor: featureThemeClassName('userBadgeColorsSuccessText'),
        badgeTextColor: featureThemeClassName('userUserWikiSuccessContrastBackground'),
      };
    case 'Rejected':
    case 'rejected':
      return {
        badge: 'destructive',
        bgColor: featureThemeClassName('userUserWikiDangerGradientSurface'),
        textColor: featureThemeClassName('userUserWikiDangerText'),
        badgeTextColor: featureThemeClassName('userUserWikiContrastText'),
      };
    case 'Under Review':
      return {
        badge: 'secondary',
        bgColor: featureThemeClassName('userUserWikiInfoAccentGradientSurface'),
        textColor: featureThemeClassName('userBadgeColorsInfoText'),
      };
    case 'Drafting':
    default:
      return {
        badge: 'outline',
        bgColor: featureThemeClassName('userUserWikiNeutralGradientSurface'),
        textColor: featureThemeClassName('userUserWikiNeutralText'),
      };
  }
}

// Function to format numbers with appropriate units (k, M)
export const formatNumberWithUnit = (num: number): { value: number; unit: string } => {
  if (num >= 1000000) {
    return { value: +(num / 1000000).toFixed(1), unit: 'M' };
  } else if (num >= 1000) {
    return { value: +(num / 1000).toFixed(1), unit: 'k' };
  }
  return { value: num, unit: '' };
};

// Function to get a deterministic color based on tag text to ensure consistency
export function getTagColor(
  tag: string,
  badgeColorVariants: { bg: string; text: string }[]
): { bg: string; text: string } {
  const hashCode = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return badgeColorVariants[hashCode % badgeColorVariants.length];
}

// Helper function to get badge color based on role
export function getRoleBadgeColor(role: string) {
  // Handle undefined or null role
  if (!role) {
    return {
      bg: featureThemeClassName('userUserWikiNeutralBackground'),
      text: featureThemeClassName('userUserWikiNeutralText'),
      badge: 'gray',
    };
  }

  switch (role.toLowerCase()) {
    case 'founder':
      return {
        bg: featureThemeClassName('timelineActionTimelineCardAccentBackground'),
        text: featureThemeClassName('userBadgeColorsAccentText'),
        badge: 'purple',
      };
    case 'advisor':
      return {
        bg: featureThemeClassName('timelineActionTimelineCardInfoBackground'),
        text: featureThemeClassName('userBadgeColorsInfoText'),
        badge: 'blue',
      };
    case 'member':
      return {
        bg: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
        text: featureThemeClassName('userBadgeColorsSuccessText'),
        badge: 'green',
      };
    default:
      return {
        bg: featureThemeClassName('userUserWikiNeutralBackground'),
        text: featureThemeClassName('userUserWikiNeutralText'),
        badge: 'gray',
      };
  }
}

// Function to get a deterministic gradient based on blog ID
export function getBlogGradient(blogId: string, gradientVariants: string[]) {
  const hash = blogId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradientVariants[hash % gradientVariants.length];
}
