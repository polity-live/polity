import type { LucideIcon } from 'lucide-react';

import {
  PageHeader,
  Panel,
  PanelContent,
  PanelGrid,
  PanelHeader,
  PanelTitle,
  Section,
} from '@/features/shared/ui/layout';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';

export interface CreateDashboardItemViewModel {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface CreateDashboardSectionViewModel {
  key: string;
  title: string;
  items: CreateDashboardItemViewModel[];
}

interface CreateDashboardViewProps {
  title: string;
  subtitle: string;
  sections: CreateDashboardSectionViewModel[];
}

export function CreateDashboardView({ title, subtitle, sections }: CreateDashboardViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={subtitle} />

      <div className="space-y-8">
        {sections.map((section: any) => (
          <Section key={section.key} title={section.title}>
            <PanelGrid>
              {section.items.map((item: any) => {
                const Icon = item.icon;

                return (
                  <SmartLink key={item.href} href={item.href} className="block">
                    <Panel className="hover:bg-accent/60 focus-within:ring-ring h-full transition-colors focus-within:ring-2">
                      <PanelHeader>
                        <Icon className="text-primary size-7" />
                        <PanelTitle>{item.title}</PanelTitle>
                      </PanelHeader>
                      <PanelContent>
                        <p className="text-muted-foreground text-sm">{item.description}</p>
                      </PanelContent>
                    </Panel>
                  </SmartLink>
                );
              })}
            </PanelGrid>
          </Section>
        ))}
      </div>
    </div>
  );
}
