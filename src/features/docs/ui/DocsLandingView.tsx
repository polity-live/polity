import { Link } from '@tanstack/react-router';

import { PageShell, Section } from '@/features/shared/ui/layout';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout/Panel';
import { Button } from '@/features/shared/ui/ui/button';
import type { DocsCategory, DocsTopicDefinition } from '../types/docs.types';
import { DocsSignalBadge } from './DocsSignalBadge';
import { DocsTopicCard } from './DocsTopicCard';

interface DocsCategorySection {
  category: DocsCategory;
  description: string;
  title: string;
  topics: DocsTopicDefinition[];
}

interface DocsLandingViewProps {
  categorySections: DocsCategorySection[];
  copy: {
    featuredDescription: string;
    featuredTitle: string;
    libraryDescription: string;
    libraryTitle: string;
    pathways: string[];
    pathwaysTitle: string;
    primaryCta: string;
    secondaryCta: string;
    subtitle: string;
    title: string;
  };
  featuredTopics: DocsTopicDefinition[];
}

export function DocsLandingView({ categorySections, copy, featuredTopics }: DocsLandingViewProps) {
  return (
    <PageShell contentClassName="flex max-w-7xl flex-col gap-12 py-10 lg:py-14">
      <Panel className="overflow-hidden">
        <PanelContent className="p-6 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="space-y-5">
              <DocsSignalBadge tone="entry" />
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  {copy.title}
                </h1>
                <p className="text-muted-foreground max-w-3xl text-lg leading-8">{copy.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/docs/$topic" params={{ topic: 'auth-and-onboarding' }}>
                    {copy.primaryCta}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/docs/$topic" params={{ topic: 'create-workflows' }}>
                    {copy.secondaryCta}
                  </Link>
                </Button>
              </div>
            </div>

            <Panel>
              <PanelHeader>
                <PanelTitle>{copy.pathwaysTitle}</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  {copy.pathways.map(item => (
                    <li key={item} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </PanelContent>
            </Panel>
          </div>
        </PanelContent>
      </Panel>

      <Section title={copy.featuredTitle} description={copy.featuredDescription}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredTopics.map(topic => (
            <DocsTopicCard key={topic.slug} topic={topic} />
          ))}
        </div>
      </Section>

      <Section title={copy.libraryTitle} description={copy.libraryDescription}>
        <div className="space-y-8">
          {categorySections.map(section => (
            <div key={section.category} className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight">{section.title}</h3>
                <p className="text-muted-foreground text-sm leading-6">{section.description}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.topics.map(topic => (
                  <DocsTopicCard key={`${section.category}-${topic.slug}`} topic={topic} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
