import { Link } from '@tanstack/react-router';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import { DocsSignalBadge } from './DocsSignalBadge';
import type { DocsTopicDefinition } from '../types/docs.types';

export function DocsTopicCard({ topic }: { topic: DocsTopicDefinition }) {
  const { t } = useTranslation();
  const Icon = getIconComponent(topic.icon);
  const baseKey = `pages.docs.topics.${topic.slug}`;

  return (
    <Link to="/docs/$topic" params={{ topic: topic.slug }} className="group block h-full">
      <Card surface="backgroundSoft" interactive="lift" className="h-full">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              <Icon className="h-5 w-5" />
            </div>
            <DocsSignalBadge tone={topic.process.steps[0]?.tone ?? 'entry'} />
          </div>
          <div className="space-y-2">
            <CardTitle size="xl" tone="primary">
              {t(`${baseKey}.title`)}
            </CardTitle>
            <CardDescription leading="relaxed">{t(`${baseKey}.summary`)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
            {t(`pages.docs.categories.${topic.category}.title`)}
          </p>
          <p className="text-foreground/80 text-sm">{t(`${baseKey}.entry`)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
