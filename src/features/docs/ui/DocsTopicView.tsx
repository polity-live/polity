import { Link } from '@tanstack/react-router';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import { PageShell, Section } from '@/features/shared/ui/layout';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout/Panel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { Button } from '@/features/shared/ui/ui/button';
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
    <PageShell contentClassName="flex max-w-7xl flex-col gap-10 py-10 lg:py-14">
      <Panel>
        <PanelContent className="flex flex-col gap-5 p-6 lg:p-10">
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
                <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-lg">
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
            <Panel>
              <PanelHeader className="space-y-2">
                <PanelTitle className="text-base">{copy.quickView}</PanelTitle>
              </PanelHeader>
              <PanelContent className="text-muted-foreground space-y-4 text-sm leading-6">
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
              </PanelContent>
            </Panel>
          </div>
        </PanelContent>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <ProcessDiagram baseKey={baseKey} process={topic.process} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>{copy.actionsLabel}</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  {actions.map((action: any) => (
                    <li key={action} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </PanelContent>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>{copy.conceptsLabel}</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  {concepts.map((concept: any) => (
                    <li key={concept} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span>{concept}</span>
                    </li>
                  ))}
                </ul>
              </PanelContent>
            </Panel>
          </div>

          <Accordion
            type="single"
            collapsible
            className="bg-card text-card-foreground rounded-lg border px-6 shadow-xs"
          >
            <AccordionItem value="watch-for">
              <AccordionTrigger className="text-base">{copy.watchFor}</AccordionTrigger>
              <AccordionContent>
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  {watchFor.map((item: any) => (
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
                  {states.map((state: any) => (
                    <div
                      key={state}
                      className="bg-background text-muted-foreground rounded-lg border p-4 text-sm leading-6"
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
          <Panel>
            <PanelHeader>
              <PanelTitle>{copy.relatedTopics}</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3">
              {relatedTopics.map((relatedTopic: any) => (
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
            </PanelContent>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>{copy.userPerspective}</PanelTitle>
            </PanelHeader>
            <PanelContent className="text-muted-foreground space-y-4 text-sm leading-6">
              <p>{copy.perspective}</p>
              <Separator />
              <p>{copy.outcome}</p>
            </PanelContent>
          </Panel>
        </aside>
      </div>

      <Section title={copy.exploreMore} description={copy.libraryDescription}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {relatedTopics.map((relatedTopic: any) => (
            <DocsTopicCard key={`card-${relatedTopic.slug}`} topic={relatedTopic} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
