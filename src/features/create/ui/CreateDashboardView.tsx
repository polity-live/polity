import { ArrowUpRight, Search, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Input } from '@/features/shared/ui/ui/input';

import { Section, WorkspaceHeader } from '@/features/shared/ui/layout';
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
  sections: CreateDashboardSectionViewModel[];
  accessibleTitle: string;
}

export function CreateDashboardView({ sections, accessibleTitle }: CreateDashboardViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        terms.every(term =>
          `${section.title} ${item.title} ${item.description}`.toLocaleLowerCase().includes(term)
        )
      ),
    }))
    .filter(section => section.items.length > 0);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WorkspaceHeader title={<span className="sr-only">{accessibleTitle}</span>}>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
          <Input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label={t('common.workspace.searchCreate')}
            placeholder={t('common.workspace.searchCreate')}
            className="pl-9"
          />
        </div>
      </WorkspaceHeader>
      <div className="space-y-6">
        {filteredSections.map(section => (
          <Section
            key={section.key}
            title={<span className="font-sans text-base">{section.title}</span>}
          >
            <div>
              {section.items.map(item => {
                const Icon = item.icon;

                return (
                  <SmartLink
                    key={item.href}
                    href={item.href}
                    data-action-id="create.dashboard.flow.open"
                    className="group hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-3 transition-colors outline-none focus-visible:ring-2"
                    data-workspace-row
                    data-create-action="open-create-flow"
                    data-create-option={item.href}
                  >
                    <Icon className="text-muted-foreground size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-sans text-sm font-medium">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                    <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
                  </SmartLink>
                );
              })}
            </div>
          </Section>
        ))}
        {filteredSections.length === 0 ? (
          <p role="status" className="text-muted-foreground py-8 text-center text-sm">
            {t('common.workspace.noCreateResults')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
