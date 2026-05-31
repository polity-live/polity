import type { ReactNode } from 'react';
import { ExternalLink, ImageIcon, PlayCircle, type LucideIcon } from 'lucide-react';

import { AspectRatio } from '@/features/shared/ui/ui/aspect-ratio';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardTitle } from '@/features/shared/ui/ui/card.tsx';
import {
  ENTITY_COLORS,
  type EntityType as ReviewEntityType,
} from '@/features/shared/utils/entity-colors';
import { cn } from '@/features/shared/utils/utils';
import {
  CONTENT_TYPE_CONFIG,
  type ContentType,
  getContentTypeGradient,
} from '@/features/timeline/constants/content-type-config';
import { getHashtagGradient } from '@/features/timeline/logic/gradient-assignment';

export interface ReviewCardField {
  label: string;
  value: ReactNode;
}

export interface ReviewCardSection {
  title?: string;
  description?: string;
  fields?: ReviewCardField[];
  content?: ReactNode;
  columns?: 1 | 2;
}

export interface ReviewMediaPreview {
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  videoLabel?: string;
}

interface SummaryFieldProps extends ReviewCardField {
  className?: string;
}

const REVIEW_BADGE_TONES: Partial<Record<ContentType, string>> = {
  statement: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200',
  payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200',
  action: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};
const DEFAULT_REVIEW_BADGE_TONE =
  'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

function getReviewBadgeClassName(entityType: ContentType): string {
  const entityColor = ENTITY_COLORS[entityType as ReviewEntityType];
  if (entityColor) {
    return entityColor.badgeBg;
  }

  return REVIEW_BADGE_TONES[entityType] ?? REVIEW_BADGE_TONES.action ?? DEFAULT_REVIEW_BADGE_TONE;
}

function normalizeGradientClassName(gradient?: string, entityType: ContentType = 'statement') {
  if (!gradient) {
    return getContentTypeGradient(entityType);
  }

  return gradient.includes('bg-gradient') ? gradient : `bg-gradient-to-br ${gradient}`;
}

function getReviewCardTheme(entityType: ContentType = 'statement', gradient?: string) {
  const config = CONTENT_TYPE_CONFIG[entityType];

  return {
    accentColor: config.accentColor,
    badgeClassName: getReviewBadgeClassName(entityType),
    borderColor: config.borderColor,
    gradientClassName: normalizeGradientClassName(gradient, entityType),
    icon: config.icon,
  };
}

function renderFieldValue(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') {
    return <span className="block text-sm leading-relaxed break-words">{value}</span>;
  }

  return value;
}

export function SummaryField({ label, value, className }: SummaryFieldProps) {
  return (
    <div
      className={cn(
        'border-border/60 bg-background/70 grid gap-1.5 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(110px,150px)_1fr] sm:items-start sm:gap-3',
        className
      )}
    >
      <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </div>
      <div className="text-foreground min-w-0 font-medium">{renderFieldValue(value)}</div>
    </div>
  );
}

export function SummaryPillList({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item, index) => (
        <Badge
          key={`${item}-${index}`}
          variant="outline"
          className="border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function ReviewCardSectionBlock({
  section,
  accentColor,
}: {
  section: ReviewCardSection;
  accentColor: string;
}) {
  const hasFields = Boolean(section.fields?.length);
  const hasContent = Boolean(section.content);
  const columns = section.columns ?? (section.fields && section.fields.length > 1 ? 2 : 1);
  const fields = section.fields ?? [];

  if (!hasFields && !hasContent) {
    return null;
  }

  return (
    <section className="border-border/70 bg-background/75 rounded-2xl border p-4 shadow-sm">
      {(section.title || section.description) && (
        <div className="mb-4 space-y-1">
          {section.title && (
            <h4 className={cn('text-sm font-semibold', accentColor)}>{section.title}</h4>
          )}
          {section.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{section.description}</p>
          )}
        </div>
      )}

      {hasFields && (
        <dl className={cn('grid gap-3', columns === 2 ? 'md:grid-cols-2' : 'grid-cols-1')}>
          {fields.map((field, index) => (
            <SummaryField key={`${field.label}-${index}`} label={field.label} value={field.value} />
          ))}
        </dl>
      )}

      {hasContent && (
        <div className={hasFields ? 'mt-4 space-y-3' : 'space-y-3'}>{section.content}</div>
      )}
    </section>
  );
}

function ReviewMediaBlock({ media, title }: { media: ReviewMediaPreview; title: string }) {
  const hasImage = Boolean(media.imageUrl);
  const hasVideo = Boolean(media.videoUrl);

  if (!hasImage && !hasVideo) {
    return null;
  }

  return (
    <section className="border-border/60 bg-background/70 border-y px-5 py-4">
      <div
        className={cn('grid gap-4', hasImage && hasVideo && 'lg:grid-cols-[minmax(0,1fr)_280px]')}
      >
        {hasImage && (
          <div className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm">
            <AspectRatio ratio={16 / 9}>
              <img
                src={media.imageUrl}
                alt={media.imageAlt ?? title}
                className="h-full w-full object-cover"
              />
            </AspectRatio>
          </div>
        )}

        {hasVideo && (
          <div
            className={cn(
              'border-border/70 bg-background/90 rounded-2xl border p-4 shadow-sm',
              !hasImage && 'max-w-full'
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300">
                <PlayCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Video attached</p>
                <p className="text-muted-foreground text-xs">
                  {media.videoLabel ?? 'Review the selected video link before creating.'}
                </p>
              </div>
            </div>

            <a
              href={media.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border/70 bg-card text-foreground hover:bg-muted/60 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{media.videoUrl}</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

interface CreateReviewCardProps {
  entityType?: ContentType;
  badge: string;
  secondaryBadge?: string;
  title: string;
  subtitle?: string;
  hashtags?: string[];
  gradient?: string;
  media?: ReviewMediaPreview;
  sections?: ReviewCardSection[];
  children?: ReactNode;
  className?: string;
}

export function CreateReviewCard({
  entityType = 'statement',
  badge,
  secondaryBadge,
  title,
  subtitle,
  hashtags,
  gradient,
  media,
  sections,
  children,
  className,
}: CreateReviewCardProps) {
  const theme = getReviewCardTheme(entityType, gradient);
  const Icon = theme.icon as LucideIcon;

  return (
    <Card
      className={cn(
        'border-border/70 bg-card text-card-foreground overflow-hidden rounded-[28px] border shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]',
        className
      )}
    >
      <div className={cn('relative overflow-hidden px-5 py-5 sm:px-6', theme.gradientClassName)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.38),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.08))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_42%,rgba(2,6,23,0.32))]" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={cn(
                  'border-transparent px-3 py-1 text-[11px] font-semibold shadow-sm',
                  theme.badgeClassName
                )}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {badge}
              </Badge>

              {secondaryBadge && (
                <Badge
                  variant="outline"
                  className="border-white/60 bg-white/75 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur-sm dark:border-white/15 dark:bg-slate-950/70 dark:text-slate-100"
                >
                  {secondaryBadge}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/60">
              <Icon className={cn('h-5 w-5', theme.accentColor)} />
            </div>

            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl leading-tight font-semibold text-slate-950 sm:text-2xl dark:text-slate-50">
                {title}
              </CardTitle>
              {subtitle && (
                <CardDescription className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {subtitle}
                </CardDescription>
              )}
            </div>
          </div>

          {hashtags && hashtags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {hashtags.map(tag => (
                <Badge
                  key={tag}
                  className={cn(
                    'border-0 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm',
                    getHashtagGradient(tag)
                  )}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {media && <ReviewMediaBlock media={media} title={title} />}

      <CardContent className="space-y-4 p-5 sm:p-6">
        {sections?.map((section, index) => (
          <ReviewCardSectionBlock
            key={`${section.title ?? 'section'}-${index}`}
            section={section}
            accentColor={theme.accentColor}
          />
        ))}

        {children && (
          <section className="border-border/70 bg-background/75 rounded-2xl border p-4 shadow-sm">
            <div className="space-y-3">{children}</div>
          </section>
        )}

        {!sections?.length && !children && (
          <section className="border-border/70 bg-background/75 text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <span>No review details available yet.</span>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
