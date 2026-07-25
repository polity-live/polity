import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, BookOpen, SearchX } from 'lucide-react';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { searchDocs } from './logic/docsSearch';
import { DocsSearchField } from './ui/DocsSearch';

export function DocsSearchPage({ initialQuery }: { initialQuery: string }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const matches = useMemo(
    () => (query.trim() ? searchDocs({ language, query, limit: 50 }) : []),
    [language, query]
  );

  const updateSearch = (value: string) => {
    setQuery(value);
    void navigate({
      to: '/docs/search',
      search: { q: value.trim() || undefined },
      replace: true,
    } as never);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="mb-9">
        <div className="text-primary mb-4 flex items-center gap-2 text-sm font-semibold tracking-[0.12em] uppercase">
          <BookOpen className="size-4" />
          Polity Docs
        </div>
        <h1 className="font-display text-4xl font-semibold md:text-5xl">
          {t('pages.docs.hub.searchTitle')}
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          {t('pages.docs.hub.searchDescription')}
        </p>
      </header>

      <DocsSearchField initialQuery={initialQuery} onSearch={updateSearch} />

      <section aria-live="polite" className="mt-9">
        {query.trim() && (
          <p className="text-muted-foreground mb-5 text-sm">
            {t('pages.docs.hub.resultCount', { count: matches.length }, `${matches.length}`)}
          </p>
        )}

        {query.trim() && matches.length === 0 ? (
          <div className="bg-card rounded-lg border px-6 py-12 text-center">
            <SearchX className="text-muted-foreground mx-auto size-8" />
            <h2 className="mt-4 font-semibold">{t('pages.docs.hub.noResults')}</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
              {t('pages.docs.hub.noResultsHint')}
            </p>
          </div>
        ) : (
          <div className="divide-y border-y">
            {matches.map(match => {
              const Icon = getIconComponent(match.page.icon);
              return (
                <Link
                  key={`${match.page.slug}:${match.section?.id ?? 'page'}`}
                  to={match.route as never}
                  className="hover:bg-card group grid gap-3 px-2 py-5 transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
                >
                  <Icon className="text-primary mt-1 size-5" />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {match.section?.title ?? match.page.title}
                    </span>
                    {match.section && (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {match.page.title}
                      </span>
                    )}
                    <span className="text-muted-foreground mt-2 block text-sm leading-6">
                      {match.excerpt}
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground mt-1 hidden size-4 transition-transform group-hover:translate-x-1 sm:block" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
