import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card'
import { GITHUB_REPOSITORY_URL, SUPPORT_EMAIL } from '@/features/shared/constants'
import { useTranslation } from '@/features/shared/hooks/use-translation'

export const Route = createFileRoute('/imprint')({
  component: ImprintPage,
})

const sectionKeys = ['overview', 'operator', 'responsibility', 'legalNotice'] as const

function ImprintPage() {
  const { t, tArray } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col">
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {t('pages.imprint.lastUpdated')}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('pages.imprint.title')}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t('pages.imprint.subtitle')}</p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 md:grid-cols-2">
        {sectionKeys.map((key) => (
          <Card key={key} className="h-full">
            <CardHeader>
              <CardTitle className="text-xl">{t(`pages.imprint.sections.${key}.title`)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tArray(`pages.imprint.sections.${key}.paragraphs`).map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="bg-muted/50 px-4 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">{t('pages.imprint.contact.title')}</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              {t('pages.imprint.contact.description')}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.imprint.contact.email.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{SUPPORT_EMAIL}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('pages.imprint.contact.email.description')}
              </p>
            </a>
            <a
              href={GITHUB_REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.imprint.contact.repository.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{GITHUB_REPOSITORY_URL}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('pages.imprint.contact.repository.description')}
              </p>
            </a>
            <Link
              to="/support"
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.imprint.contact.support.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">/support</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('pages.imprint.contact.support.description')}
              </p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}