import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export function StudioProjectsTab({ userId }: { userId: string }) {
  const t = useTranslation().t;
  const [projects, result] = useQuery(queries.studio.byOwner({ ownerId: userId }));
  if (result.type === 'unknown') return <p role="status">{t('features.studio.loading')}</p>;
  if (result.type === 'error')
    return <p role="alert">{t('features.studio.projectsUnavailable')}</p>;
  if (!projects.length)
    return <p className="text-muted-foreground py-8 text-center">{t('features.studio.empty')}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map(project => (
        <SmartLink
          data-action-id="users.studio-project.open.link"
          key={project.id}
          href={
            project.group_id
              ? `/group/${project.group_id}/studio/${project.id}`
              : `/studio/${project.id}`
          }
          className="bg-card hover:border-primary rounded-xl border p-5"
        >
          <div className="mb-3 flex h-24 items-center justify-center rounded bg-[#12362D] px-3 text-center font-serif text-lg text-[#FFFCF6]">
            {project.title}
          </div>
          <strong>{project.title}</strong>
          <p className="text-muted-foreground text-sm">
            {t(`features.studio.${project.kind}`)} ·{' '}
            {t(`pages.create.common.${project.visibility}`)}
          </p>
        </SmartLink>
      ))}
    </div>
  );
}
