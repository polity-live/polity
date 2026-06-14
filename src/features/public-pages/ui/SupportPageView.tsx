import { Code2, Palette, WalletCards, type LucideIcon } from 'lucide-react';

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

export interface SupportAreaViewModel {
  key: string;
  title: string;
  description: string;
  details: string[];
  cta: string;
  href: string;
  external?: boolean;
  icon: 'financial' | 'design' | 'development';
}

const supportIcons: Record<SupportAreaViewModel['icon'], LucideIcon> = {
  financial: WalletCards,
  design: Palette,
  development: Code2,
};

interface SupportPageViewProps {
  title: string;
  subtitle: string;
  howCanHelp: string;
  areas: SupportAreaViewModel[];
  communityTitle: string;
  communityDescription: string;
  getStartedLabel: string;
}

export function SupportPageView({
  title,
  subtitle,
  howCanHelp,
  areas,
  communityTitle,
  communityDescription,
  getStartedLabel,
}: SupportPageViewProps) {
  return (
    <PageShell contentClassName="max-w-6xl py-12 sm:py-16">
      <PageHeader title={title} description={subtitle} className="items-center text-center" />

      <Section title={howCanHelp} headerClassName="justify-center text-center">
        <PanelGrid>
          {areas.map((area: SupportAreaViewModel) => {
            const Icon = supportIcons[area.icon];

            return (
              <Panel key={area.key}>
                <PanelHeader>
                  <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
                    <Icon className="size-5" />
                  </div>
                  <PanelTitle className="text-xl">{area.title}</PanelTitle>
                  <p className="text-muted-foreground text-sm">{area.description}</p>
                </PanelHeader>
                <PanelContent className="space-y-4">
                  <ul className="space-y-2">
                    {area.details.map((detail: any) => (
                      <li key={detail} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">{'\u2022'}</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {area.external ? (
                    <Button asChild variant="outline" className="w-full">
                      <a href={area.href} target="_blank" rel="noopener noreferrer">
                        {area.cta}
                      </a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <a href={area.href}>{area.cta}</a>
                    </Button>
                  )}
                </PanelContent>
              </Panel>
            );
          })}
        </PanelGrid>
      </Section>

      <Section className="text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">{communityTitle}</h2>
          <p className="text-muted-foreground">{communityDescription}</p>
          <Button asChild size="lg">
            <a href="/auth">{getStartedLabel}</a>
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
