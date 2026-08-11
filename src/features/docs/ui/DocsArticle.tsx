import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';

import { getIconComponent } from '@/features/navigation/nav-items/icon-map';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { useAuth } from '@/providers/auth-provider';
import { getDocsNavigation, getDocsPages, getRelatedDocsPages } from '../logic/docsRegistry';
import type { DocsPage } from '../types/docs.types';

function safeDocsUrlTransform(url: string): string {
  if (/^\/(?!\/)/.test(url) || /^(https?:|mailto:)/i.test(url)) {
    return defaultUrlTransform(url);
  }
  return '';
}

function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={safeDocsUrlTransform}
      components={{
        p: ({ children }) => <p className="mb-4 leading-7 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="text-foreground font-semibold">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 list-disc space-y-2 pl-6 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-3 pl-6 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
        code: ({ children }) => (
          <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-primary bg-muted/60 my-5 border-l-4 px-5 py-4">
            {children}
          </blockquote>
        ),
        a: ({ href = '', children }) => (
          <a
            data-action-id="docs.article.markdown-link.open"
            href={href}
            className="text-primary font-medium underline underline-offset-4"
            {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => (
          <img
            src={typeof src === 'string' ? src : ''}
            alt={alt ?? ''}
            loading="lazy"
            className="bg-muted my-6 w-full rounded-lg border object-cover shadow-sm"
          />
        ),
        table: ({ children }) => (
          <div className="my-5 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="bg-muted border-b p-3 text-left">{children}</th>,
        td: ({ children }) => <td className="border-b p-3 align-top">{children}</td>,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function useActiveSection(page: DocsPage) {
  const [activeSection, setActiveSection] = useState(page.sections[0]?.id ?? '');

  useEffect(() => {
    setActiveSection(page.sections[0]?.id ?? '');
    const elements = page.sections
      .map(section => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: [0, 1] }
    );
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [page]);

  return activeSection;
}

function TableOfContents({ page, activeSection }: { page: DocsPage; activeSection: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('pages.docs.hub.onThisPage')}>
      <p className="mb-3 text-sm font-semibold">{t('pages.docs.hub.onThisPage')}</p>
      <ul className="border-l">
        {page.sections.map(section => (
          <li key={section.id}>
            <a
              data-action-id="docs.article.toc.jump"
              href={`#${section.id}`}
              aria-current={activeSection === section.id ? 'location' : undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground -ml-px block border-l px-4 py-1.5 text-sm leading-5 transition-colors',
                activeSection === section.id && 'border-primary text-foreground font-medium'
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DocsArticle({ page }: { page: DocsPage }) {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const Icon = getIconComponent(page.icon);
  const activeSection = useActiveSection(page);
  const groups = getDocsNavigation(language);
  const group = groups.find(candidate => candidate.id === page.category);
  const relatedPages = getRelatedDocsPages(page, language);
  const allPages = getDocsPages(language);
  const pageIndex = allPages.findIndex(candidate => candidate.slug === page.slug);
  const previousPage = pageIndex > 0 ? allPages[pageIndex - 1] : null;
  const nextPage = pageIndex < allPages.length - 1 ? allPages[pageIndex + 1] : null;

  const metadata = useMemo(
    () => [
      page.kind === 'getting-started'
        ? t('pages.docs.hub.startTitle')
        : (group?.title ?? t('pages.docs.hub.browseTitle')),
      page.audience,
    ],
    [group?.title, page.audience, page.kind, t]
  );
  const primaryAction = page.primaryAction;
  const primaryActionRoute =
    primaryAction?.requiresAuth && !user
      ? (primaryAction.signedOutRoute ?? '/auth/sign-in')
      : primaryAction?.route;
  const primaryActionLabel =
    primaryAction?.requiresAuth && !user
      ? (primaryAction.signedOutLabel ?? primaryAction.label)
      : primaryAction?.label;

  return (
    <main className="mx-auto grid w-full max-w-[86rem] gap-10 px-5 py-8 md:px-8 md:py-12 xl:grid-cols-[minmax(0,52rem)_15rem] xl:px-12">
      <article className="min-w-0">
        <div className="text-muted-foreground mb-8 flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/docs"
            data-action-id="docs.article.home.open"
            className="hover:text-foreground"
          >
            {t('pages.docs.hub.overview')}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{group?.title}</span>
          <span aria-hidden="true">/</span>
          <span className="text-foreground">{page.title}</span>
        </div>

        <header className="border-b pb-8">
          <div className="bg-primary/10 text-primary mb-5 flex size-12 items-center justify-center rounded-lg">
            <Icon className="size-6" />
          </div>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
            {page.title}
          </h1>
          <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
            {page.description}
          </p>
          <div className="text-muted-foreground mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {metadata.map((item, index) => (
              <span key={item} className="flex items-center gap-4">
                {index > 0 && <span aria-hidden="true">•</span>}
                <span>{item}</span>
              </span>
            ))}
          </div>
          {primaryAction && primaryActionRoute && primaryActionLabel ? (
            <Button asChild className="mt-6" data-action-id="docs.article.primary-action.open">
              <Link
                to={primaryActionRoute as never}
                data-action-id="docs.article.primary-action.open"
              >
                {primaryActionLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </header>

        <details className="bg-card mt-6 rounded-lg border p-4 xl:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
            {t('pages.docs.hub.showContents')}
            <ChevronDown className="size-4" />
          </summary>
          <div className="mt-4">
            <TableOfContents page={page} activeSection={activeSection} />
          </div>
        </details>

        <div className="divide-y">
          {page.sections.map(section => (
            <section key={section.id} id={section.id} className="scroll-mt-24 py-9">
              <h2 className="font-display mb-5 text-2xl font-semibold tracking-tight md:text-3xl">
                <a
                  href={`#${section.id}`}
                  data-action-id="docs.article.section.jump"
                  className="hover:text-primary"
                >
                  {section.title}
                </a>
              </h2>
              <div className="text-foreground/85 max-w-none">
                <DocsMarkdown markdown={section.markdown} />
              </div>
            </section>
          ))}
        </div>

        {relatedPages.length > 0 && (
          <section className="border-t pt-9">
            <h2 className="font-display mb-5 text-2xl font-semibold">
              {t('pages.docs.hub.related')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedPages.map(related => {
                const RelatedIcon = getIconComponent(related.icon);
                return (
                  <Link
                    data-action-id="docs.article.related.open"
                    key={related.slug}
                    to={related.route as never}
                    className="bg-card hover:border-ring group rounded-lg border p-4 transition-colors"
                  >
                    <RelatedIcon className="text-primary mb-3 size-5" />
                    <p className="font-semibold">{related.title}</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
                      {related.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <nav
          aria-label={t('common.accessibility.guidePagination')}
          className="mt-10 grid gap-3 border-t pt-6 sm:grid-cols-2"
        >
          {previousPage ? (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-start py-3"
              data-action-id="docs.article.previous.open"
            >
              <Link to={previousPage.route as never} data-action-id="docs.article.previous.open">
                <ArrowLeft className="size-4" />
                <span className="min-w-0 text-left">
                  <span className="text-muted-foreground block text-xs">
                    {t('pages.docs.hub.previousResult')}
                  </span>
                  <span className="block truncate">{previousPage.title}</span>
                </span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {nextPage && (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-end py-3"
              data-action-id="docs.article.next.open"
            >
              <Link to={nextPage.route as never} data-action-id="docs.article.next.open">
                <span className="min-w-0 text-right">
                  <span className="text-muted-foreground block text-xs">
                    {t('pages.docs.hub.nextResult')}
                  </span>
                  <span className="block truncate">{nextPage.title}</span>
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <TableOfContents page={page} activeSection={activeSection} />
        </div>
      </aside>
    </main>
  );
}
