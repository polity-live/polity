import {
  CreateReviewCard,
  type ReviewCardField,
  type ReviewCardSection,
  type ReviewMediaPreview,
} from '@/features/shared/ui/form';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { ReactNode } from 'react';

export interface CreateSummaryStepProps {
  entityType: ContentType;
  badge: string;
  secondaryBadge?: string;
  title: string;
  subtitle?: string;
  hashtags?: string[];
  fields?: ReviewCardField[];
  sections?: ReviewCardSection[];
  media?: ReviewMediaPreview;
  layoutId?: string;
  overlayMode?: boolean;
  /** Extra content to render below the sections. */
  children?: ReactNode;
}

export function CreateSummaryStep({
  entityType,
  badge,
  secondaryBadge,
  title,
  subtitle,
  hashtags,
  fields,
  sections,
  media,
  layoutId = 'create-review-card',
  overlayMode = false,
  children,
}: CreateSummaryStepProps) {
  const resolvedSections =
    sections && sections.length > 0
      ? sections
      : fields && fields.length > 0
        ? [{ fields }]
        : undefined;

  return (
    <CreateReviewCard
      entityType={entityType}
      badge={badge}
      secondaryBadge={secondaryBadge}
      title={title}
      subtitle={subtitle}
      hashtags={hashtags}
      media={media}
      sections={resolvedSections}
      layoutId={layoutId}
      overlayMode={overlayMode}
    >
      {children}
    </CreateReviewCard>
  );
}
