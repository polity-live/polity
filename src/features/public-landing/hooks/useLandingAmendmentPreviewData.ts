'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  buildLandingAmendmentPreviewData,
  type LandingAmendmentPreviewData,
} from '@/features/public-landing/logic/landingAmendmentPreview';

export function useLandingAmendmentPreviewData(): LandingAmendmentPreviewData {
  const { t, tArray } = useTranslation();
  const paragraphs = tArray('pages.home.publicLanding.amendmentText.paragraphs');
  const paragraphKey = paragraphs.join('\u0001');

  return useMemo(
    () =>
      buildLandingAmendmentPreviewData({
        documentTitle: t('pages.home.publicLanding.amendmentText.documentTitle'),
        paragraphs,
        changeRequestTitle: t('pages.home.publicLanding.changeRequest.requestTitle'),
        changeRequestSubtitle: t('pages.home.publicLanding.changeRequest.subtitle'),
        removedText: t('pages.home.publicLanding.changeRequest.removed'),
        addedText: t('pages.home.publicLanding.changeRequest.added'),
        eventTitle: t('pages.home.publicLanding.timeline.items.event.title'),
        eventDescription: t('pages.home.publicLanding.timeline.items.event.description'),
        workflowDescription: t('pages.home.publicLanding.timeline.items.changeRequest.description'),
      }),
    [paragraphKey, paragraphs, t]
  );
}
