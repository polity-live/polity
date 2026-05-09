'use client';

import { useMemo } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import {
  DynamicTimelineCard,
  LAZY_CARD_COMPONENTS,
  type CardType,
} from '@/features/timeline/ui/LazyCardComponents';
import { cn } from '@/features/shared/utils/utils';
import type { AiChatAttachment } from '@/lib/ai/schemas';
import {
  buildUploadAttachmentDownloadUrl,
  formatUploadFileSize,
  isUploadAttachmentCardPayload,
  type UploadAttachmentCardPayload,
} from '../logic/uploadAttachmentCard';

interface AiContextCardsProps {
  attachments?: readonly AiChatAttachment[];
  contextJson?: string | null;
  contextLabel?: 'input' | 'output';
  resolveAttachmentCardData?: (
    entityType: AiChatAttachment['entityType'],
    entityId: string
  ) => string | null;
  className?: string;
}

interface CardPayload {
  cardType: CardType;
  cardProps: Record<string, unknown>;
}

type AttachmentCardPayload = CardPayload | UploadAttachmentCardPayload;

type RenderableContextCard =
  | {
      kind: 'timeline';
      key: string;
      cardPayload: CardPayload;
    }
  | {
      kind: 'upload';
      key: string;
      attachment: AiChatAttachment;
      cardPayload: UploadAttachmentCardPayload;
    }
  | {
      kind: 'skill';
      key: string;
      attachment: AiChatAttachment;
    }
  | {
      kind: 'attachment';
      key: string;
      attachment: AiChatAttachment;
    };

type SkillContextCard = Extract<RenderableContextCard, { kind: 'skill' }>;
type NonSkillContextCard = Exclude<RenderableContextCard, SkillContextCard>;

function isAttachment(value: unknown): value is AiChatAttachment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.entityType === 'string' &&
    typeof record.entityId === 'string' &&
    typeof record.title === 'string'
  );
}

function parseAttachments(contextJson?: string | null): AiChatAttachment[] {
  if (!contextJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(contextJson);
    return Array.isArray(parsed) ? parsed.filter(isAttachment) : [];
  } catch {
    return [];
  }
}

function isCardPayload(value: unknown): value is CardPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.cardType === 'string' &&
    record.cardType in LAZY_CARD_COMPONENTS &&
    typeof record.cardProps === 'object' &&
    record.cardProps !== null
  );
}

function parseAttachmentCardPayload(cardDataJson?: string | null): AttachmentCardPayload | null {
  if (!cardDataJson) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(cardDataJson);

    if (isCardPayload(parsed)) {
      return parsed;
    }

    if (isUploadAttachmentCardPayload(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function getSkillPreview(promptContext?: string | null): string | null {
  const normalized = promptContext?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function formatEntityTypeLabel(entityType: string): string {
  return entityType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function UploadContextCard({
  attachment,
  cardPayload,
}: {
  attachment: AiChatAttachment;
  cardPayload: UploadAttachmentCardPayload;
}) {
  const { t } = useTranslation();
  const showImagePreview = cardPayload.previewType === 'image';
  const fileSizeLabel = formatUploadFileSize(cardPayload.fileSize);
  const downloadUrl = buildUploadAttachmentDownloadUrl(cardPayload.fileUrl, cardPayload.fileName);

  return (
    <Card className="bg-background/80 overflow-hidden border-sky-500/20">
      {showImagePreview && (
        <a href={cardPayload.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={cardPayload.fileUrl}
            alt={cardPayload.fileName}
            className="max-h-80 w-full object-cover"
            loading="lazy"
          />
        </a>
      )}

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
              {showImagePreview ? (
                <ImageIcon className="h-5 w-5 text-sky-700 dark:text-sky-300" />
              ) : (
                <FileText className="h-5 w-5 text-sky-700 dark:text-sky-300" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold">{attachment.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {attachment.subtitle ??
                  [cardPayload.fileType, fileSizeLabel].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <Badge className="border-0 bg-sky-500/15 text-[10px] text-sky-700 dark:text-sky-300">
            {showImagePreview
              ? t('common.actions.uploadImage', 'Upload Image')
              : formatEntityTypeLabel(attachment.entityType)}
          </Badge>
        </div>

        {!showImagePreview && (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
            {cardPayload.fileType || t('features.messages.compose.fileFallbackLabel', 'File')} ·{' '}
            {fileSizeLabel}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={cardPayload.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/15 dark:text-sky-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('features.messages.compose.openAttachment', 'Open')}
          </a>
          <a
            href={downloadUrl}
            download={cardPayload.fileName}
            className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {t('features.messages.compose.downloadAttachment', 'Download')}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function AiContextCards({
  attachments,
  contextJson,
  contextLabel = 'input',
  resolveAttachmentCardData,
  className,
}: AiContextCardsProps) {
  const { t } = useTranslation();
  const resolvedAttachments = useMemo(
    () => attachments ?? parseAttachments(contextJson),
    [attachments, contextJson]
  );

  const cards = useMemo(
    () =>
      resolvedAttachments.flatMap<RenderableContextCard>(attachment => {
        const key = `${attachment.entityType}:${attachment.entityId}`;
        const cardPayload = parseAttachmentCardPayload(
          attachment.card_data_json ??
            resolveAttachmentCardData?.(attachment.entityType, attachment.entityId) ??
            null
        );

        if (cardPayload && 'kind' in cardPayload && cardPayload.kind === 'upload') {
          return [{ kind: 'upload', key, attachment, cardPayload }];
        }

        if (cardPayload) {
          return [{ kind: 'timeline', key, cardPayload }];
        }

        if (attachment.entityType === 'skill') {
          return [{ kind: 'skill', key, attachment }];
        }

        return [{ kind: 'attachment', key, attachment }];
      }),
    [resolveAttachmentCardData, resolvedAttachments]
  );

  const contextCards = useMemo(
    () => cards.filter((card): card is NonSkillContextCard => card.kind !== 'skill'),
    [cards]
  );

  const skillCards = useMemo(
    () => cards.filter((card): card is SkillContextCard => card.kind === 'skill'),
    [cards]
  );
  const isOutputContext = contextLabel === 'output';

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2 md:max-w-xl', className)}>
      {contextCards.length > 0 && (
        <div
          className={cn(
            'overflow-hidden rounded-2xl bg-gradient-to-br',
            isOutputContext
              ? 'via-background/80 border border-emerald-500/20 from-emerald-500/10 to-teal-500/10'
              : 'via-background/80 border border-sky-500/20 from-sky-500/10 to-cyan-500/10'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase',
              isOutputContext
                ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300'
            )}
          >
            <Search className="h-3.5 w-3.5" />
            {contextLabel === 'output'
              ? t('features.messages.ai.outputContextCardLabel', 'Output context')
              : t('features.messages.ai.inputContextCardLabel', 'Input context')}
          </div>

          <div className="grid gap-2 p-3">
            {contextCards.map(card => {
              if (card.kind === 'timeline') {
                return (
                  <DynamicTimelineCard
                    key={card.key}
                    cardType={card.cardPayload.cardType}
                    cardProps={card.cardPayload.cardProps}
                  />
                );
              }

              if (card.kind === 'upload') {
                return (
                  <UploadContextCard
                    key={card.key}
                    attachment={card.attachment}
                    cardPayload={card.cardPayload}
                  />
                );
              }

              const preview = getSkillPreview(card.attachment.prompt_context);

              return (
                <Card key={card.key} className="bg-background/80 overflow-hidden border-sky-500/20">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {card.attachment.title}
                        </p>
                        {card.attachment.subtitle && (
                          <p className="text-muted-foreground truncate text-xs">
                            {card.attachment.subtitle}
                          </p>
                        )}
                      </div>
                      <Badge className="border-0 bg-sky-500/15 text-[10px] text-sky-700 dark:text-sky-300">
                        {formatEntityTypeLabel(card.attachment.entityType)}
                      </Badge>
                    </div>

                    {preview && (
                      <p className="text-muted-foreground line-clamp-4 text-sm leading-6">
                        {preview}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {skillCards.map(card => {
        const promptPreview = getSkillPreview(card.attachment.prompt_context);

        return (
          <Card
            key={card.key}
            className="via-background overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-lime-500/10"
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-emerald-700 uppercase dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('features.messages.ai.skillCardLabel', 'Skill')}
                  </div>
                  <p className="text-foreground truncate text-sm font-semibold">
                    {card.attachment.title}
                  </p>
                  {card.attachment.subtitle && (
                    <p className="text-muted-foreground truncate text-xs">
                      /{card.attachment.subtitle}
                    </p>
                  )}
                </div>
                <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300">
                  {t('features.messages.ai.skillCardBadge', 'AI mode')}
                </Badge>
              </div>

              {promptPreview && (
                <p className="text-muted-foreground line-clamp-4 text-sm leading-6">
                  {promptPreview}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
