'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { PlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
import { FileText, GitPullRequest, Vote } from 'lucide-react';
import { ChangeRequestSummaryItem } from '@/features/change-requests/ui/ChangeRequestSummaryItem';
import { useLandingAmendmentPreviewData } from '@/features/public-landing/hooks/useLandingAmendmentPreviewData';
import {
  LANDING_AMENDMENT_REVIEWER_ID,
  LANDING_AMENDMENT_USER_ID,
  type LandingAmendmentPreviewData,
} from '@/features/public-landing/logic/landingAmendmentPreview';
import { ProductStoryPoint } from './ProductStoryPoint';

const amendmentRequestAnimationStepMs = 1200;

export function LandingAmendmentSectionContentContainer() {
  const { tArray } = useTranslation();
  const previewData = useLandingAmendmentPreviewData();
  const points = tArray('pages.home.publicLanding.sections.amendments.points');

  return <LandingAmendmentSectionContentView points={points} previewData={previewData} />;
}

function LandingAmendmentSectionContentView({
  points,
  previewData,
}: {
  points: string[];
  previewData: LandingAmendmentPreviewData;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-4">
          {points.map((point, index) => (
            <ProductStoryPoint
              key={point}
              icon={index === 0 ? FileText : index === 1 ? GitPullRequest : Vote}
              text={point}
            />
          ))}
        </div>
        <LandingAmendmentEditorPreview previewData={previewData} />
      </div>
    </div>
  );
}

function LandingAmendmentEditorPreview({
  previewData,
}: {
  previewData: LandingAmendmentPreviewData;
}) {
  const { t } = useTranslation();
  const motionScopeRef = useRef<HTMLDivElement>(null);
  const [hasMotionStarted, setHasMotionStarted] = useState(false);

  useEffect(() => {
    if (hasMotionStarted) {
      return;
    }

    const motionScope = motionScopeRef.current;

    if (!motionScope || typeof IntersectionObserver === 'undefined') {
      setHasMotionStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setHasMotionStarted(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '0px 0px -18% 0px',
        threshold: 0.2,
      }
    );

    observer.observe(motionScope);

    return () => observer.disconnect();
  }, [hasMotionStarted]);

  return (
    <div className="bg-card h-full overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.amendmentWorkspace.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.amendmentWorkspace.description')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            {t('pages.home.publicLanding.amendmentWorkspace.badge')}
          </BadgeControl>
        </div>
      </div>
      <div className="space-y-4 p-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {t('pages.home.publicLanding.amendmentText.title')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.amendmentText.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeControl variant="secondary">
            {t('pages.home.publicLanding.amendmentText.status')}
          </BadgeControl>
          <BadgeControl variant="outline">#climate</BadgeControl>
          <BadgeControl variant="outline">#budget</BadgeControl>
        </div>
        <div
          ref={motionScopeRef}
          className="landing-amendment-motion-scope space-y-4"
          data-motion-started={hasMotionStarted ? 'true' : 'false'}
        >
          <div className="landing-amendment-request-tray grid gap-2 sm:grid-cols-2">
            {previewData.changeRequests.map((request, index) => (
              <ChangeRequestSummaryItem
                key={request.id}
                identifier={request.crId}
                title={request.title}
                changeType={request.type}
                motionDelayMs={index * amendmentRequestAnimationStepMs}
                variant="preview"
              />
            ))}
          </div>
          <div className="change-request-load-motion landing-amendment-editor-motion relative">
            <PlateEditor
              key={t('pages.home.publicLanding.amendmentText.documentTitle')}
              initialValue={previewData.documentValue}
              readOnly
              showFixedToolbar={false}
              showSettingsDialog={false}
              documentId="landing-amendment-preview"
              documentTitle={t('pages.home.publicLanding.amendmentText.documentTitle')}
              currentMode="event_final_closing_vote"
              currentUser={{
                id: LANDING_AMENDMENT_REVIEWER_ID,
                name: 'Review delegate',
              }}
              users={{
                [LANDING_AMENDMENT_USER_ID]: {
                  id: LANDING_AMENDMENT_USER_ID,
                  name: 'Policy lead',
                  avatarUrl: '',
                },
                [LANDING_AMENDMENT_REVIEWER_ID]: {
                  id: LANDING_AMENDMENT_REVIEWER_ID,
                  name: 'Review delegate',
                  avatarUrl: '',
                },
              }}
              discussions={previewData.discussions}
              editorVariant="demo"
              containerVariant="demo"
              containerClassName="max-h-[22rem] overflow-y-auto rounded-md border bg-background"
              editorClassName="min-h-[16rem] py-4 pr-12 pl-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
