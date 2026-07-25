import { Link } from '@tanstack/react-router';
import { ArrowRight, BookOpen, Compass, Search, Sparkles } from 'lucide-react';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getDocsNavigation, getDocsPages } from './logic/docsRegistry';
import { DocsSearchTrigger } from './ui/DocsSearch';

export function DocsLandingPage() {
  const { t, language } = useTranslation();
  const pages = getDocsPages(language);
  const starterPages = pages.filter(page => page.kind === 'getting-started');
  const featuredGuides = pages.filter(page => page.kind === 'guide' && page.featured).slice(0, 6);
  const guideGroups = getDocsNavigation(language).filter(group => group.id !== 'getting-started');

  return (
    <main>
      <section className="border-b px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="text-primary mb-5 flex items-center justify-center gap-2 text-sm font-semibold tracking-[0.14em] uppercase">
            <Sparkles className="size-4" />
            Polity Docs
          </div>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight md:text-6xl">
            {t('pages.docs.overview.title')}
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-3xl text-lg leading-8">
            {t('pages.docs.overview.subtitle')}
          </p>
          <DocsSearchTrigger prominent className="mx-auto mt-9 max-w-3xl" />
        </div>
      </section>

      <div className="mx-auto max-w-[86rem] space-y-16 px-5 py-12 md:px-8 md:py-16 xl:px-12">
        <section aria-labelledby="getting-started-title">
          <div className="mb-6 flex items-end justify-between gap-5">
            <div>
              <div className="text-primary mb-2 flex items-center gap-2 text-sm font-semibold">
                <Compass className="size-4" />
                01
              </div>
              <h2 id="getting-started-title" className="font-display text-3xl font-semibold">
                {t('pages.docs.hub.startTitle')}
              </h2>
              <p className="text-muted-foreground mt-2">{t('pages.docs.hub.startDescription')}</p>
            </div>
          </div>
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {starterPages.map((page, index) => (
              <li key={page.slug}>
                <Link
                  to={page.route as never}
                  className="bg-card hover:border-ring group flex h-full min-h-48 flex-col rounded-lg border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-primary font-mono text-xs font-semibold">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{page.title}</h3>
                  <p className="text-muted-foreground mt-2 flex-1 text-sm leading-6">
                    {page.description}
                  </p>
                  <span className="text-primary mt-5 flex items-center gap-2 text-sm font-semibold">
                    {t('pages.docs.hub.readGuide')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="featured-guides-title">
          <div className="mb-6">
            <div className="text-primary mb-2 flex items-center gap-2 text-sm font-semibold">
              <Search className="size-4" />
              02
            </div>
            <h2 id="featured-guides-title" className="font-display text-3xl font-semibold">
              {t('pages.docs.overview.featuredTitle')}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t('pages.docs.overview.featuredDescription')}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredGuides.map(page => {
              const Icon = getIconComponent(page.icon);
              return (
                <Link
                  key={page.slug}
                  to={page.route as never}
                  className="bg-card hover:border-ring group rounded-lg border p-5 transition-colors"
                >
                  <Icon className="text-primary size-5" />
                  <h3 className="mt-4 font-semibold">{page.title}</h3>
                  <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
                    {page.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="all-guides-title">
          <div className="mb-8">
            <div className="text-primary mb-2 flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4" />
              03
            </div>
            <h2 id="all-guides-title" className="font-display text-3xl font-semibold">
              {t('pages.docs.hub.browseTitle')}
            </h2>
            <p className="text-muted-foreground mt-2">{t('pages.docs.hub.browseDescription')}</p>
          </div>
          <div className="space-y-10">
            {guideGroups.map(group => (
              <div key={group.id}>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">{group.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{group.description}</p>
                </div>
                <div className="grid gap-x-8 gap-y-1 border-t md:grid-cols-2 xl:grid-cols-3">
                  {group.pages.map(page => (
                    <Link
                      key={page.slug}
                      to={page.route as never}
                      className="hover:text-primary flex items-center justify-between gap-3 border-b py-3 text-sm font-medium transition-colors"
                    >
                      <span>{page.title}</span>
                      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
