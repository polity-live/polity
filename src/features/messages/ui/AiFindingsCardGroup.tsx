'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import type { AiPresentationBlock, AiFindingTone } from '@/lib/ai/messageContext';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const INITIAL_VISIBLE_ITEMS = 4;

const FINDING_TONE_CLASSES: Record<AiFindingTone, string> = {
  neutral: 'border-border bg-muted/35',
  info: 'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)]/35',
  success: 'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)]/35',
  warning: 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]/35',
  danger: 'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)]/35',
};

export function AiFindingsCardGroup({ presentation }: { presentation: AiPresentationBlock }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded
    ? presentation.items
    : presentation.items.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenCount = presentation.items.length - INITIAL_VISIBLE_ITEMS;

  return (
    <section className="border-border/70 bg-card/60 overflow-hidden rounded-2xl border">
      <header className="border-border/60 flex items-start gap-3 border-b px-4 py-3">
        <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold">{presentation.title}</h4>
          {presentation.summary ? (
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              {presentation.summary}
            </p>
          ) : null}
        </div>
        <BadgeControl variant="outline" size="tiny">
          {presentation.items.length}
        </BadgeControl>
      </header>

      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {visibleItems.map(item => (
          <Card key={item.id} className={cn('shadow-none', FINDING_TONE_CLASSES[item.tone])}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-snug font-semibold">{item.title}</p>
                {item.badge ? (
                  <BadgeControl variant="outline" size="tiny" className="shrink-0">
                    {item.badge}
                  </BadgeControl>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <div className="border-border/60 border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(current => !current)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                {t('features.messages.ai.showFewerResults')}
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                {t('features.messages.ai.showMoreResults', { count: hiddenCount })}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
