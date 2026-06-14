import { useTranslation } from '@/features/shared/hooks/use-translation';

export function useMasonryGridEmptyController() {
  const { t } = useTranslation();

  return {
    labels: {
      title: t('features.timeline.empty.title'),
      hint: t('features.timeline.emptyTimelineHint'),
      discoverContent: t('features.timeline.discoverContent'),
    },
  };
}
