import type { ReactNode } from 'react';

import {
  PageHeader,
  PageShell,
  Panel,
  PanelContent,
  PanelGrid,
  PanelHeader,
  PanelTitle,
  Section,
} from '@/features/shared/ui/layout';
import { Button } from '@/features/shared/ui/ui/button';

export interface LegalInfoSectionViewModel {
  key: string;
  title: string;
  paragraphs: string[];
  items: string[];
}

export interface LegalInfoRelatedLink {
  to: '/terms-and-conditions' | '/privacy-policy' | '/imprint' | '/support' | '/auth';
  title: string;
  description: string;
}

interface LegalInfoPageViewProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalInfoSectionViewModel[];
  relatedTitle: string;
  relatedDescription: string;
  relatedLinks: LegalInfoRelatedLink[];
  relatedActionLabel?: ReactNode;
}

export function LegalInfoPageView({
  title,
  subtitle,
  lastUpdated,
  sections,
  relatedTitle,
  relatedDescription,
  relatedLinks,
  relatedActionLabel,
}: LegalInfoPageViewProps) {
  return (
    <PageShell contentClassName="max-w-5xl py-12 sm:py-16">
      <PageHeader
        eyebrow={lastUpdated}
        title={title}
        description={subtitle}
        className="items-center text-center"
      />

      <PanelGrid className="md:grid-cols-2 xl:grid-cols-2">
        {sections.map((section: any) => (
          <Panel key={section.key} className="h-full">
            <PanelHeader>
              <PanelTitle className="text-xl">{section.title}</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-4">
              {section.paragraphs.map((paragraph: any) => (
                <p key={paragraph} className="text-muted-foreground text-sm leading-6">
                  {paragraph}
                </p>
              ))}
              {section.items.length > 0 ? (
                <ul className="text-muted-foreground space-y-2 text-sm">
                  {section.items.map((item: any) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">{'\u2022'}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </PanelContent>
          </Panel>
        ))}
      </PanelGrid>

      <Section className="bg-muted/50 -mx-4 px-4 py-12 text-center sm:-mx-6 lg:-mx-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">{relatedTitle}</h2>
          <p className="text-muted-foreground max-w-2xl">{relatedDescription}</p>
          <div className="grid w-full gap-4 md:grid-cols-3">
            {relatedLinks.map((link: any) => (
              <Panel key={link.to} className="text-left">
                <PanelContent className="space-y-3 pt-4 sm:pt-5">
                  <div>
                    <p className="font-semibold">{link.title}</p>
                    <p className="text-muted-foreground mt-2 text-sm">{link.description}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={link.to}>{relatedActionLabel ?? link.title}</a>
                  </Button>
                </PanelContent>
              </Panel>
            ))}
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
