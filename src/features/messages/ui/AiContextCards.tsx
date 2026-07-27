'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Pencil,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  getEntityToneClasses,
  getSemanticToneClasses,
  type EntityTone,
} from '@/features/shared/theme';
import { getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import type { AiChatAttachment } from '@/lib/ai/schemas';
import {
  buildUploadAttachmentDownloadUrl,
  formatUploadFileSize,
  isUploadAttachmentCardPayload,
  type UploadAttachmentCardPayload,
} from '../logic/uploadAttachmentCard';
import { parseContextAttachments, parseContextPresentations } from '../logic/contextAttachments';
import { AiFindingsCardGroup } from './AiFindingsCardGroup';

const INITIAL_VISIBLE_RESULTS = 4;
const ENTITY_TONES = new Set<EntityTone>([
  'user',
  'group',
  'event',
  'amendment',
  'blog',
  'agenda_item',
  'vote',
  'election',
  'todo',
  'role',
]);

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

type ResultContextCard =
  | {
      kind: 'upload';
      key: string;
      attachment: AiChatAttachment;
      cardPayload: UploadAttachmentCardPayload;
    }
  | {
      kind: 'entity';
      key: string;
      attachment: AiChatAttachment;
    };

interface SkillContextCard {
  kind: 'skill';
  key: string;
  attachment: AiChatAttachment;
}

type RenderableContextCard = ResultContextCard | SkillContextCard;
type ContextSectionType = 'input' | 'output' | 'update';

function parseUploadPayload(cardDataJson?: string | null): UploadAttachmentCardPayload | null {
  if (!cardDataJson) return null;

  try {
    const parsed: unknown = JSON.parse(cardDataJson);
    return isUploadAttachmentCardPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getPreview(promptContext?: string | null): string | null {
  const normalized = promptContext?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function formatEntityTypeLabel(entityType: string): string {
  return entityType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getAttachmentTone(entityType: AiChatAttachment['entityType']) {
  return ENTITY_TONES.has(entityType as EntityTone)
    ? getEntityToneClasses(entityType as EntityTone)
    : getSemanticToneClasses('neutral');
}

function EntityResultCard({
  attachment,
  tutorialAnchor,
}: {
  attachment: AiChatAttachment;
  tutorialAnchor?: string;
}) {
  const { t } = useTranslation();
  const Icon = getEntityIcon(attachment.entityType);
  const tone = getAttachmentTone(attachment.entityType);
  const preview = getPreview(attachment.prompt_context);
  const body = (
    <Card
      className={cn(
        'h-full shadow-none transition-colors',
        tone.border,
        attachment.href && 'hover:bg-muted/45'
      )}
    >
      <CardContent className="flex h-full items-start gap-3 p-3">
        <span
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone.badge)}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{attachment.title}</p>
              {attachment.subtitle ? (
                <p className="text-muted-foreground truncate text-xs">{attachment.subtitle}</p>
              ) : null}
            </div>
            <BadgeControl variant="outline" size="tiny" className={cn('shrink-0', tone.badge)}>
              {formatEntityTypeLabel(attachment.entityType)}
            </BadgeControl>
          </div>
          {preview ? (
            <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
              {preview}
            </p>
          ) : null}
          {attachment.href ? (
            <span className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium">
              {t('features.messages.ai.openResult')}
              <ExternalLink className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return attachment.href ? (
    <SmartLink
      href={attachment.href}
      data-tutorial-anchor={tutorialAnchor}
      className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </SmartLink>
  ) : (
    body
  );
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
    <Card className="h-full overflow-hidden shadow-none">
      <CardContent className="flex h-full items-start gap-3 p-3">
        <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {showImagePreview ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{attachment.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {attachment.subtitle ??
              [cardPayload.fileType, fileSizeLabel].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs font-medium">
            <a
              href={cardPayload.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {t('features.messages.compose.openAttachment')}
            </a>
            <a
              href={downloadUrl}
              download={cardPayload.fileName}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              {t('features.messages.compose.downloadAttachment')}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContextCardSection({
  cards,
  contextType,
}: {
  cards: readonly ResultContextCard[];
  contextType: ContextSectionType;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleCards = expanded ? cards : cards.slice(0, INITIAL_VISIBLE_RESULTS);
  const hiddenCount = Math.max(0, cards.length - INITIAL_VISIBLE_RESULTS);
  const label =
    contextType === 'input'
      ? t('features.messages.ai.inputContextCardLabel')
      : contextType === 'update'
        ? t('features.messages.ai.updateContextCardLabel')
        : t('features.messages.ai.outputContextCardLabel');
  const ContextIcon = contextType === 'update' ? Pencil : Search;

  if (cards.length === 0) return null;

  return (
    <section
      aria-label={label}
      className="border-border/70 bg-card/60 overflow-hidden rounded-2xl border"
    >
      <header className="border-border/60 flex items-center gap-2 border-b px-4 py-3">
        <ContextIcon className="text-muted-foreground h-4 w-4" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</p>
        <BadgeControl variant="outline" size="tiny">
          {cards.length}
        </BadgeControl>
      </header>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {visibleCards.map(card =>
          card.kind === 'upload' ? (
            <UploadContextCard
              key={card.key}
              attachment={card.attachment}
              cardPayload={card.cardPayload}
            />
          ) : (
            <EntityResultCard
              key={card.key}
              attachment={card.attachment}
              tutorialAnchor={
                contextType === 'output' && card.attachment.entityType === 'todo'
                  ? 'tutorial-assistant-todo-output'
                  : undefined
              }
            />
          )
        )}
      </div>
      {hiddenCount > 0 ? (
        <div className="border-border/60 border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? (
              <ChevronUp className="mr-2 h-4 w-4" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            {expanded
              ? t('features.messages.ai.showFewerResults')
              : t('features.messages.ai.showMoreResults', { count: hiddenCount })}
          </Button>
        </div>
      ) : null}
    </section>
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
    () => attachments ?? parseContextAttachments(contextJson),
    [attachments, contextJson]
  );
  const presentations = useMemo(() => parseContextPresentations(contextJson), [contextJson]);
  const cards = useMemo(
    () =>
      resolvedAttachments.map<RenderableContextCard>(attachment => {
        const key = `${attachment.entityType}:${attachment.entityId}`;
        const uploadPayload = parseUploadPayload(
          attachment.card_data_json ??
            resolveAttachmentCardData?.(attachment.entityType, attachment.entityId) ??
            null
        );
        if (uploadPayload) return { kind: 'upload', key, attachment, cardPayload: uploadPayload };
        if (attachment.entityType === 'skill') return { kind: 'skill', key, attachment };
        return { kind: 'entity', key, attachment };
      }),
    [resolveAttachmentCardData, resolvedAttachments]
  );
  const resultCards = cards.filter((card): card is ResultContextCard => card.kind !== 'skill');
  const skillCards = cards.filter((card): card is SkillContextCard => card.kind === 'skill');
  const inputCards = contextLabel === 'input' ? resultCards : [];
  const outputCards =
    contextLabel === 'output'
      ? resultCards.filter(card => card.attachment.context_type !== 'update')
      : [];
  const updateCards =
    contextLabel === 'output'
      ? resultCards.filter(card => card.attachment.context_type === 'update')
      : [];

  if (cards.length === 0 && presentations.length === 0) return null;

  return (
    <div className={cn('space-y-3 md:max-w-3xl', className)}>
      <ContextCardSection cards={inputCards} contextType="input" />
      <ContextCardSection cards={outputCards} contextType="output" />
      <ContextCardSection cards={updateCards} contextType="update" />

      {presentations.map(presentation => (
        <AiFindingsCardGroup key={presentation.id} presentation={presentation} />
      ))}

      {skillCards.map(card => (
        <Card key={card.key} className="border-border/70 shadow-none">
          <CardContent className="flex items-start gap-3 p-3">
            <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{card.attachment.title}</p>
                  {card.attachment.subtitle ? (
                    <p className="text-muted-foreground truncate text-xs">
                      /{card.attachment.subtitle}
                    </p>
                  ) : null}
                </div>
                <BadgeControl variant="outline" size="tiny">
                  {t('features.messages.ai.skillCardBadge')}
                </BadgeControl>
              </div>
              {getPreview(card.attachment.prompt_context) ? (
                <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
                  {getPreview(card.attachment.prompt_context)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
