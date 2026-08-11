import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckSquare,
  ExternalLink,
  FileText,
  GitBranch,
  Image,
  ImageIcon,
  ListOrdered,
  PlayCircle,
  Quote,
  User,
  Video,
  Vote,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { AspectRatio } from '@/features/shared/ui/ui/aspect-ratio';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardTitle } from '@/features/shared/ui/ui/card.tsx';
import type { EntityType as ReviewEntityType } from '@/features/shared/utils/entity-colors';
import {
  getContentTypeToneClasses,
  getEntityGradientClasses,
  getEntityToneClasses,
  getSemanticToneClasses,
  type CivicContentType,
} from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { getHashtagGradient } from '@/features/shared/logic/hashtagHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type ReviewContentType =
  ReviewEntityType | 'meetup' | 'video' | 'image' | 'statement' | 'payment' | 'action' | 'workflow';

export type ContentType = ReviewContentType;

interface ReviewThemeConfig {
  icon: LucideIcon;
  gradient: string;
  gradientDark: string;
  accentColor: string;
  borderColor: string;
}

function createReviewThemeConfig(type: ReviewContentType, icon: LucideIcon): ReviewThemeConfig {
  const tone = getReviewToneClasses(type);

  return {
    icon,
    gradient: getReviewContentTypeGradient(type),
    gradientDark: '',
    accentColor: tone.text,
    borderColor: tone.border,
  };
}

const REVIEW_CONTENT_TYPE_CONFIG: Record<ReviewContentType, ReviewThemeConfig> = {
  group: createReviewThemeConfig('group', Building2),
  event: createReviewThemeConfig('event', Calendar),
  meetup: createReviewThemeConfig('meetup', Video),
  amendment: createReviewThemeConfig('amendment', FileText),
  agenda_item: createReviewThemeConfig('agenda_item', ListOrdered),
  vote: createReviewThemeConfig('vote', Vote),
  election: createReviewThemeConfig('election', Award),
  video: createReviewThemeConfig('video', Video),
  image: createReviewThemeConfig('image', Image),
  statement: createReviewThemeConfig('statement', Quote),
  todo: createReviewThemeConfig('todo', CheckSquare),
  blog: createReviewThemeConfig('blog', BookOpen),
  payment: createReviewThemeConfig('payment', Wallet),
  action: createReviewThemeConfig('action', Zap),
  workflow: createReviewThemeConfig('workflow', GitBranch),
  user: createReviewThemeConfig('user', User),
  role: createReviewThemeConfig('role', User),
};

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

function getReviewBadgeClassName(entityType: ReviewContentType): string {
  return getReviewToneClasses(entityType).badge;
}

function getReviewContentTypeGradient(entityType: ReviewContentType): string {
  if (entityType === 'role') {
    return getEntityGradientClasses('role');
  }

  return getEntityGradientClasses(entityType as CivicContentType);
}

function normalizeGradientClassName(
  gradient?: string,
  entityType: ReviewContentType = 'statement'
) {
  if (!gradient) {
    return getReviewContentTypeGradient(entityType);
  }

  return gradient.includes('bg-gradient') || /(^|\s)bg-/.test(gradient)
    ? gradient
    : `bg-gradient-to-br ${gradient}`;
}

function getReviewToneClasses(entityType: ReviewContentType) {
  if (entityType === 'role') {
    return getEntityToneClasses('role');
  }

  return getContentTypeToneClasses(entityType as CivicContentType);
}

function getReviewCardTheme(entityType: ReviewContentType = 'statement', gradient?: string) {
  const config = REVIEW_CONTENT_TYPE_CONFIG[entityType];

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

function SummaryDefinitionField({ label, value }: ReviewCardField) {
  return (
    <div className="border-border/60 bg-background/70 grid gap-1.5 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(110px,150px)_1fr] sm:items-start sm:gap-3">
      <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </dt>
      <dd className="text-foreground min-w-0 font-medium">{renderFieldValue(value)}</dd>
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
            <SummaryDefinitionField
              key={`${field.label}-${index}`}
              label={field.label}
              value={field.value}
            />
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
              <div className={cn('rounded-md p-2', getSemanticToneClasses('danger').badge)}>
                <PlayCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {translateText('generated.inline.1129_video_attached_c26a2e47')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {media.videoLabel ??
                    translateText(
                      'generated.inline.0139_review_the_selected_video_link_before_creatin_b64dc912'
                    )}
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
  layoutId?: string;
  overlayMode?: boolean;
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
  layoutId,
  overlayMode = false,
}: CreateReviewCardProps) {
  const theme = getReviewCardTheme(entityType, gradient);
  const Icon = theme.icon as LucideIcon;

  const card = (
    <Card
      className={cn(
        'border-border/70 bg-card text-card-foreground overflow-hidden rounded-[28px] border shadow-[var(--shadow-floating)]',
        overlayMode && 'max-h-[min(64dvh,720px)] overflow-y-auto overscroll-contain',
        className
      )}
    >
      <div className={cn('relative overflow-hidden px-5 py-5 sm:px-6', theme.gradientClassName)}>
        <div className="absolute inset-0 bg-[var(--surface-overlay)] opacity-55" />

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
                  className={cn(
                    'px-3 py-1 text-[11px] font-semibold backdrop-blur-sm',
                    getSemanticToneClasses('neutral').badge
                  )}
                >
                  {secondaryBadge}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <div className="border-border rounded-2xl border bg-[var(--surface-overlay)] p-3 shadow-sm backdrop-blur-sm">
              <Icon className={cn('h-5 w-5', theme.accentColor)} />
            </div>

            <div className="min-w-0 flex-1">
              <CardTitle className="text-foreground text-xl leading-tight font-semibold sm:text-2xl">
                {title}
              </CardTitle>
              {subtitle && (
                <CardDescription className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
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
                    'px-2.5 py-1 text-[11px] font-semibold shadow-sm',
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
              <span>
                {translateText('generated.inline.1130_no_review_details_available_yet_36acfcc2')}
              </span>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );

  if (layoutId) {
    return (
      <motion.div data-slot="create-review-card-motion" layoutId={layoutId}>
        {card}
      </motion.div>
    );
  }

  return card;
}
