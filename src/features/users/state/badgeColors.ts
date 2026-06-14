import { featureThemeClassName } from '@/features/shared/theme';
export const BADGE_COLORS = [
  {
    bg: featureThemeClassName('timelineActionTimelineCardInfoBackground'),
    text: featureThemeClassName('userBadgeColorsInfoText'),
  },
  {
    bg: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
    text: featureThemeClassName('userBadgeColorsSuccessText'),
  },
  {
    bg: featureThemeClassName('timelineActionTimelineCardAccentBackground'),
    text: featureThemeClassName('userBadgeColorsAccentText'),
  },
  {
    bg: featureThemeClassName('timelineActionTimelineCardWarningBackground'),
    text: featureThemeClassName('userBadgeColorsWarningText'),
  },
  {
    bg: featureThemeClassName('timelineActionTimelineCardDangerBackground'),
    text: featureThemeClassName('userBadgeColorsDangerText'),
  },
  {
    bg: featureThemeClassName('userBadgeColorsAccentBackground'),
    text: featureThemeClassName('userBadgeColorsAccentTextAlpha'),
  },
  {
    bg: featureThemeClassName('timelineTopicPillTealBackground'),
    text: featureThemeClassName('userBadgeColorsTealText'),
  },
];
