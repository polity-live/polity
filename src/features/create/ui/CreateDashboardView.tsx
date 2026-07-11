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
import { usePreloadCoordinator } from '@/zero/preloads';

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
  const preloadContext = usePreloadCoordinator();
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
                  <SmartLink
                    key={item.href}
                    href={item.href}
                    className="block"
                    onMouseEnter={() => preloadContext?.beginIntent(item.href)}
                    onMouseLeave={() => preloadContext?.cancelIntent(item.href)}
                    onFocus={() => preloadContext?.beginIntent(item.href)}
                    onBlur={() => preloadContext?.cancelIntent(item.href)}
                    onTouchStart={() => preloadContext?.beginIntent(item.href)}
                  >
                    <Panel
                      className="hover:bg-accent/60 focus-within:ring-ring h-full transition-colors focus-within:ring-2"
                      data-create-action="open-create-flow"
                      data-create-option={item.href}
                    >
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
