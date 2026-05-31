import {
  CreateReviewCard,
  type ReviewCardField,
  type ReviewCardSection,
  type ReviewMediaPreview,
} from '@/features/shared/ui/ui/create-review-card';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { ReactNode } from 'react';

interface CreateSummaryStepProps {
  entityType: ContentType;
  badge: string;
  secondaryBadge?: string;
  title: string;
  subtitle?: string;
  hashtags?: string[];
  fields?: ReviewCardField[];
  sections?: ReviewCardSection[];
  media?: ReviewMediaPreview;
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
    >
      {children}
    </CreateReviewCard>
  );
}
