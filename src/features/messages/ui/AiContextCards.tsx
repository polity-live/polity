'use client';

import { useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';
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

type RenderableContextCard =
  | {
      kind: 'timeline';
      key: string;
      cardPayload: CardPayload;
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

function parseCardPayload(cardDataJson?: string | null): CardPayload | null {
  if (!cardDataJson) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(cardDataJson);
    return isCardPayload(parsed) ? parsed : null;
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
        const cardPayload = parseCardPayload(
          attachment.card_data_json ??
            resolveAttachmentCardData?.(attachment.entityType, attachment.entityId) ??
            null
        );

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
