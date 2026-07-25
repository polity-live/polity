import { Link, useRouterState } from '@tanstack/react-router';
import { BookOpen, ChevronDown } from 'lucide-react';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { getDocsNavigation } from '../logic/docsRegistry';

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t, language } = useTranslation();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const groups = getDocsNavigation(language);

  return (
    <nav aria-label={t('pages.docs.hub.sidebarTitle')} className="space-y-5">
      <Link
        to="/docs"
        onClick={onNavigate}
        className={cn(
          'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
          pathname === '/docs' && 'bg-accent text-accent-foreground'
        )}
      >
        <BookOpen className="size-4" />
        {t('pages.docs.hub.overview')}
      </Link>

      {groups.map(group => (
        <details key={group.id} open className="group">
          <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase">
            <span>{group.title}</span>
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-0.5">
            {group.pages.map(page => {
              const Icon = getIconComponent(page.icon);
              const active = pathname === page.route;
              return (
                <li key={page.slug}>
                  <Link
                    to={page.route as never}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm leading-5 transition-colors',
                      active && 'bg-accent text-accent-foreground font-medium'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{page.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
}
