import { Link } from '@tanstack/react-router';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Separator } from '@/features/shared/ui/ui/separator';

import type { DocsTopicDefinition } from '../types/docs.types';
import { DocsSignalBadge } from './DocsSignalBadge';
import { DocsTopicCard } from './DocsTopicCard';
import { ProcessDiagram } from './ProcessDiagram';

interface DocsTopicViewProps {
  actions: string[];
  audience: string;
  baseKey: string;
  concepts: string[];
  copy: {
    actionsLabel: string;
    audienceLabel: string;
    conceptsLabel: string;
    entryLabel: string;
    exploreMore: string;
    libraryDescription: string;
    navLabel: string;
    outcome: string;
    perspective: string;
    quickView: string;
    relatedTopicLabels: Record<string, string>;
    relatedTopics: string;
    statesLabel: string;
    userPerspective: string;
    watchFor: string;
  };
  entry: string;
  relatedTopics: DocsTopicDefinition[];
  states: string[];
  summary: string;
  title: string;
  topic: DocsTopicDefinition;
  watchFor: string[];
}

export function DocsTopicView({
  actions,
  audience,
  baseKey,
  concepts,
  copy,
  entry,
  relatedTopics,
  states,
  summary,
  title,
  topic,
  watchFor,
}: DocsTopicViewProps) {
  const Icon = getIconComponent(topic.icon);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_40%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 lg:px-6 lg:py-14">
        <div className="border-border/60 bg-background/90 flex flex-col gap-5 rounded-[2rem] border p-6 shadow-sm lg:p-10">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <Link to="/docs" className="hover:text-foreground">
              {copy.navLabel}
            </Link>
            <span>/</span>
            <span>{title}</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-3xl">
                  <Icon className="h-7 w-7" />
                </div>
                <DocsSignalBadge tone={topic.process.steps[0]?.tone ?? 'entry'} />
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  {title}
                </h1>
                <p className="text-muted-foreground max-w-3xl text-lg leading-8">{summary}</p>
              </div>
            </div>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">{copy.quickView}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-4 text-sm leading-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase">
                    {copy.audienceLabel}
                  </p>
                  <p className="text-foreground/80 mt-1">{audience}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase">
                    {copy.entryLabel}
                  </p>
                  <p className="text-foreground/80 mt-1">{entry}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <ProcessDiagram baseKey={baseKey} process={topic.process} />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>{copy.actionsLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                    {actions.map(action => (
                      <li key={action} className="flex gap-3">
                        <span className="text-primary mt-1">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>{copy.conceptsLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                    {concepts.map(concept => (
                      <li key={concept} className="flex gap-3">
                        <span className="text-primary mt-1">•</span>
                        <span>{concept}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Accordion
              type="single"
              collapsible
              className="border-border/60 bg-card/80 rounded-3xl border px-6"
            >
              <AccordionItem value="watch-for">
                <AccordionTrigger className="text-base">{copy.watchFor}</AccordionTrigger>
                <AccordionContent>
                  <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                    {watchFor.map(item => (
                      <li key={item} className="flex gap-3">
                        <span className="text-primary mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="states">
                <AccordionTrigger className="text-base">{copy.statesLabel}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {states.map(state => (
                      <div
                        key={state}
                        className="border-border/60 bg-background/70 text-muted-foreground rounded-2xl border p-4 text-sm leading-6"
                      >
                        {state}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>{copy.relatedTopics}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedTopics.map(relatedTopic => (
                  <Button
                    key={relatedTopic.slug}
                    asChild
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Link to="/docs/$topic" params={{ topic: relatedTopic.slug }}>
                      {copy.relatedTopicLabels[relatedTopic.slug]}
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-primary/[0.05]">
              <CardHeader>
                <CardTitle>{copy.userPerspective}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-4 text-sm leading-6">
                <p>{copy.perspective}</p>
                <Separator />
                <p>{copy.outcome}</p>
              </CardContent>
            </Card>
          </aside>
        </div>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.exploreMore}</h2>
            <p className="text-muted-foreground">{copy.libraryDescription}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedTopics.map(relatedTopic => (
              <DocsTopicCard key={`card-${relatedTopic.slug}`} topic={relatedTopic} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
