import { Link } from '@tanstack/react-router';

import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_26%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 lg:px-6 lg:py-14">
        <section className="border-border/60 bg-background/90 overflow-hidden rounded-[2rem] border p-6 shadow-sm lg:p-10">
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

            <Card className="border-border/60 bg-card/85">
              <CardHeader>
                <CardTitle>{copy.pathwaysTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  {copy.pathways.map(item => (
                    <li key={item} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.featuredTitle}</h2>
            <p className="text-muted-foreground">{copy.featuredDescription}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredTopics.map(topic => (
              <DocsTopicCard key={topic.slug} topic={topic} />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.libraryTitle}</h2>
            <p className="text-muted-foreground">{copy.libraryDescription}</p>
          </div>

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
        </section>
      </div>
    </div>
  );
}
