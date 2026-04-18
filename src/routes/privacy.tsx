import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card'
import { useTranslation } from '@/features/shared/hooks/use-translation'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

const sectionKeys = [
  'overview',
  'dataCollection',
  'usage',
  'sharing',
  'retention',
  'rights',
  'security',
] as const

function PrivacyPage() {
  const { t, tArray } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col">
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {t('pages.privacy.lastUpdated')}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('pages.privacy.title')}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t('pages.privacy.subtitle')}</p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 md:grid-cols-2">
        {sectionKeys.map((key) => {
          const items = tArray(`pages.privacy.sections.${key}.items`)

          return (
            <Card key={key} className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">{t(`pages.privacy.sections.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tArray(`pages.privacy.sections.${key}.paragraphs`).map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {items.length > 0 && (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5 text-primary">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="bg-muted/50 px-4 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold">{t('pages.privacy.related.title')}</h2>
          <p className="max-w-2xl text-muted-foreground">{t('pages.privacy.related.description')}</p>
          <div className="grid w-full gap-4 md:grid-cols-3">
            <Link
              to="/terms"
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.privacy.related.terms.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('pages.privacy.related.terms.description')}
              </p>
            </Link>
            <Link
              to="/imprint"
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.privacy.related.imprint.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('pages.privacy.related.imprint.description')}
              </p>
            </Link>
            <Link
              to="/support"
              className="hover:bg-accent rounded-lg border bg-background p-5 text-left transition-colors"
            >
              <p className="font-semibold">{t('pages.privacy.related.support.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('pages.privacy.related.support.description')}
              </p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}