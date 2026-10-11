import { useMemo, useState } from 'react';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import { Plus } from 'lucide-react';
import { CollectionToolbar } from '@/features/shared/ui/collections/CollectionToolbar';
import { EntityListRow } from '@/features/shared/ui/collections/EntityListRow';
import { useCollectionView } from '@/features/shared/ui/collections/useCollectionView';
import { SearchField } from '@/features/shared/ui/form';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Tabs, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { useStudioController } from '../hooks/useStudioController';
import { StudioInvitations } from './StudioInvitations';

type StudioProject = ReturnType<typeof useStudioController>['projects'][number];
type OwnerFilter = 'all' | 'mine' | 'shared';

interface StudioProjectOverviewProps {
  groupId: string | null;
  ownerId: string;
  projects: readonly StudioProject[];
  isLoading: boolean;
  failure: string;
  projectHref: (id: string) => string;
}

export function StudioProjectOverview({
  groupId,
  ownerId,
  projects,
  isLoading,
  failure,
  projectHref,
}: StudioProjectOverviewProps) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const { view, setView } = useCollectionView(groupId ? 'studio.group' : 'studio.personal');
  const [manageableGroup] = useQuery(groupId ? queries.studio.manageGroup({ groupId }) : undefined);
  const studioProjects = projects;
  const visibleProjects = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return studioProjects.filter(project => {
      if (query && !project.title.toLocaleLowerCase().includes(query)) return false;
      if (groupId || ownerFilter === 'all') return true;
      return ownerFilter === 'mine' ? project.owner_id === ownerId : project.owner_id !== ownerId;
    });
  }, [groupId, ownerFilter, ownerId, searchQuery, studioProjects]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <h1 className="sr-only">{tr('title')}</h1>
      {failure && (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      )}
      <CollectionToolbar
        search={
          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={tr('searchProjects')}
            aria-label={tr('searchProjects')}
            clearLabel={t('common.actions.clear')}
          />
        }
        view={view}
        onViewChange={setView}
        actions={
          !groupId || manageableGroup ? (
            <SmartLink
              href={
                groupId
                  ? `/create/studio-project?groupId=${encodeURIComponent(groupId)}`
                  : '/create/studio-project'
              }
              aria-label={tr('create')}
              data-action-id="communication-studio.studio-workspace.create"
              className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center gap-2 rounded-md text-sm font-medium sm:w-auto sm:px-3"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tr('create')}</span>
            </SmartLink>
          ) : null
        }
      />
      {!groupId && (
        <Tabs value={ownerFilter} onValueChange={value => setOwnerFilter(value as OwnerFilter)}>
          <ScrollableTabsList>
            <TabsTrigger
              value="all"
              data-action-id="communication-studio.studio-overview.filter.all"
            >
              {tr('allProjects')}
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              data-action-id="communication-studio.studio-overview.filter.mine"
            >
              {tr('myProjects')}
            </TabsTrigger>
            <TabsTrigger
              value="shared"
              data-action-id="communication-studio.studio-overview.filter.shared"
            >
              {tr('sharedWithMe')}
            </TabsTrigger>
          </ScrollableTabsList>
        </Tabs>
      )}
      <section aria-label={tr('projects')}>
        {isLoading ? (
          <p role="status" className="text-muted-foreground py-8 text-center">
            {tr('loading')}
          </p>
        ) : visibleProjects.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              {studioProjects.length === 0 ? tr('empty') : tr('noMatchingProjects')}
            </CardContent>
          </Card>
        ) : view === 'compact' ? (
          <div className="bg-card overflow-hidden rounded-xl border">
            {visibleProjects.map(project => (
              <EntityListRow
                key={project.id}
                type="document"
                typeLabel={tr(project.kind)}
                title={project.title}
                summary={project.is_template ? tr('templateSaved') : undefined}
                metadata={!groupId && project.owner_id !== ownerId ? tr('sharedWithMe') : undefined}
                href={projectHref(project.id)}
                actionId="communication-studio.studio-workspace.open"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map(project => (
              <SmartLink
                data-action-id="communication-studio.studio-workspace.open"
                key={project.id}
                className="bg-card hover:border-primary rounded-xl border p-5 text-left"
                href={projectHref(project.id)}
              >
                <div className="mb-4 flex h-28 items-center justify-center rounded bg-[#12362D] font-serif text-xl text-[#FFFCF6]">
                  {project.title}
                </div>
                <span className="font-semibold">{project.title}</span>
                <p className="text-muted-foreground text-sm">
                  {tr(project.kind)}
                  {project.is_template ? ` · ${tr('templateSaved')}` : ''}
                  {!groupId && project.owner_id !== ownerId ? ` · ${tr('sharedWithMe')}` : ''}
                </p>
              </SmartLink>
            ))}
          </div>
        )}
      </section>
      {!groupId && <StudioInvitations />}
    </main>
  );
}
