'use client';

import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Calendar,
  Calculator,
  CheckCircle2,
  Database,
  FileText,
  MapPinned,
  MessageSquare,
  Network,
  Route,
  Search,
  ShieldCheck,
  Users,
  Vote,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { featureThemeClassName } from '@/features/shared/theme';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { PublicSiteFooter } from '@/features/shared/ui/PublicSiteFooter';
import { SUPPORT_EMAIL, GITHUB_REPOSITORY_URL } from '@/features/shared/constants';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { MotionGroup, MotionItem } from '@/features/shared/motion';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { ProductStoryPoint } from './ProductStoryPoint';
import { DeferredLandingPreview } from './DeferredLandingPreview';
import { LandingRevealSection } from './LandingRevealSection';

const featureCards = [
  { key: 'groups', icon: Users },
  { key: 'events', icon: Calendar },
  { key: 'amendments', icon: FileText },
  { key: 'agendas', icon: Vote },
  { key: 'search', icon: Search },
  { key: 'messages', icon: MessageSquare },
] as const;
const solutionKeys = ['humans', 'parties', 'ngos', 'corporations', 'government'] as const;
const imprintSectionKeys = ['overview', 'operator', 'responsibility'] as const;
const decisionIcons = [FileText, Workflow, Vote] as const;
const decisionFallbackSteps = ['Proposal', 'Amendment', 'Vote'] as const;

const loadNetworkPreview = () =>
  import('./LandingNetworkFlowPreview').then(module => ({
    default: module.LandingNetworkFlowPreview,
  }));
const loadAmendmentPreview = () =>
  import('./LandingAmendmentSectionContent').then(module => ({
    default: module.LandingAmendmentSectionContentContainer,
  }));
const loadAgendaPreview = () =>
  import('./LandingAgendaTimelinePreview').then(module => ({
    default: module.LandingAgendaTimelinePreview,
  }));
const loadVotePreview = () =>
  import('./LandingVoteElectionPreview').then(module => ({
    default: module.LandingVoteElectionPreview,
  }));
const loadStreetPreview = () =>
  import('./LandingCityDesignPreview').then(module => ({
    default: module.LandingCityDesignPreview,
  }));
const loadSocialPreview = () =>
  import('./LandingSocialAiPreview').then(module => ({
    default: module.LandingSocialAiPreview,
  }));
const loadActivityPreview = () =>
  import('./LandingActivityStripPreview').then(module => ({
    default: module.LandingActivityStripPreview,
  }));
const loadSearchPreview = () =>
  import('./LandingSearchPreview').then(module => ({
    default: module.LandingSearchPreview,
  }));
const loadOfficialDataPreview = () =>
  import('./LandingOfficialDataPreview').then(module => ({
    default: module.LandingOfficialDataPreview,
  }));

export function PublicLandingPage() {
  const { t, tArray } = useTranslation();

  return (
    <div className="public-landing-page bg-background text-foreground min-h-screen overflow-x-clip">
      <section id="home" className="scroll-mt-24 border-b">
        <div className="mx-auto flex max-w-7xl flex-col justify-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[62svh] lg:px-8">
          <MotionGroup className="max-w-4xl space-y-6">
            <MotionItem className="bg-background inline-flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
              <span
                className={featureThemeClassName('publiclandingPublicLandingPageNeutralBackground')}
              >
                <img
                  src="/apple-touch-icon.png"
                  alt={translateText('generated.inline.1100_polity_logo_bd879dd4')}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-md"
                />
              </span>
              <div>
                <p className="text-muted-foreground text-sm font-medium uppercase">
                  {translateText('generated.inline.1101_polity_f147ffe2')}
                </p>
                <p className="text-base font-semibold tracking-tight">
                  {t('pages.home.publicLanding.hero.productLine')}
                </p>
              </div>
            </MotionItem>

            <MotionItem className="space-y-4">
              <p className="text-brand text-sm font-semibold uppercase">
                {t('pages.home.publicLanding.hero.eyebrow')}
              </p>
              <h1 className="max-w-4xl text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl">
                {t('pages.home.publicLanding.hero.title')}
              </h1>
              <LandingDecisionFlow steps={tArray('pages.home.publicLanding.hero.decisionFlow')} />
              <p className="text-muted-foreground max-w-3xl text-lg leading-8">
                {t('pages.home.publicLanding.hero.subtitle')}
              </p>
            </MotionItem>

            <MotionItem className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="landing-hero-primary-cta">
                <Link to="/auth">{t('pages.home.publicLanding.hero.primaryCta')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <SmartLink href="/#features">
                  {t('pages.home.publicLanding.hero.secondaryCta')}
                </SmartLink>
              </Button>
            </MotionItem>
          </MotionGroup>
        </div>
      </section>

      <LandingRevealSection id="features" className="bg-muted/20 scroll-mt-24 border-b">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={t('pages.home.publicLanding.sections.features.eyebrow')}
            title={t('pages.home.publicLanding.sections.features.title')}
            description={t('pages.home.publicLanding.sections.features.description')}
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ key, icon: Icon }) => (
              <div key={key}>
                <Card className="landing-feature-card h-full" interactive="spotlight">
                  <CardHeader className="space-y-3 p-5">
                    <div className="landing-feature-icon bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {t(`pages.features.features.${key}.title`)}
                      </CardTitle>
                      <CardDescription leading="relaxed" className="mt-2">
                        {t(`pages.features.features.${key}.description`)}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </LandingRevealSection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.network.eyebrow')}
        title={t('pages.home.publicLanding.sections.network.title')}
        description={t('pages.home.publicLanding.sections.network.description')}
      >
        <StoryPoints
          points={tArray('pages.home.publicLanding.sections.network.points')}
          icons={[Network, Workflow, Vote]}
        />
        <DeferredLandingPreview
          load={loadNetworkPreview}
          minHeight={620}
          label={t('pages.home.publicLanding.sections.network.title')}
        />
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.amendments.eyebrow')}
        title={t('pages.home.publicLanding.sections.amendments.title')}
        description={t('pages.home.publicLanding.sections.amendments.description')}
      >
        <DeferredLandingPreview
          load={loadAmendmentPreview}
          minHeight={640}
          label={t('pages.home.publicLanding.sections.amendments.title')}
        />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.events.eyebrow')}
        title={t('pages.home.publicLanding.sections.events.title')}
        description={t('pages.home.publicLanding.sections.events.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <StoryPoints
            points={tArray('pages.home.publicLanding.sections.events.points')}
            icons={[Calendar, Vote, Workflow]}
            stacked
          />
          <DeferredLandingPreview
            load={loadAgendaPreview}
            minHeight={560}
            label={t('pages.home.publicLanding.sections.events.title')}
          />
        </div>
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.votesElections.eyebrow')}
        title={t('pages.home.publicLanding.sections.votesElections.title')}
        description={t('pages.home.publicLanding.sections.votesElections.description')}
      >
        <StoryPoints
          points={tArray('pages.home.publicLanding.sections.votesElections.points')}
          icons={[Vote, Users, CheckCircle2]}
        />
        <DeferredLandingPreview
          load={loadVotePreview}
          minHeight={500}
          label={t('pages.home.publicLanding.sections.votesElections.title')}
        />
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.cityDesign.eyebrow')}
        title={t('pages.home.publicLanding.sections.cityDesign.title')}
        description={t('pages.home.publicLanding.sections.cityDesign.description')}
      >
        <StoryPoints
          points={tArray('pages.home.publicLanding.sections.cityDesign.points')}
          icons={[MapPinned, Route, Calculator]}
        />
        <DeferredLandingPreview
          load={loadStreetPreview}
          minHeight={760}
          label={t('pages.home.publicLanding.sections.cityDesign.title')}
        />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.social.eyebrow')}
        title={t('pages.home.publicLanding.sections.social.title')}
        description={t('pages.home.publicLanding.sections.social.description')}
      >
        <DeferredLandingPreview
          load={loadSocialPreview}
          minHeight={620}
          label={t('pages.home.publicLanding.sections.social.title')}
        />
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.timeline.eyebrow')}
        title={t('pages.home.publicLanding.sections.timeline.title')}
        description={t('pages.home.publicLanding.sections.timeline.description')}
      >
        <DeferredLandingPreview
          load={loadActivityPreview}
          minHeight={500}
          label={t('pages.home.publicLanding.sections.timeline.title')}
        />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.search.eyebrow')}
        title={t('pages.home.publicLanding.sections.search.title')}
        description={t('pages.home.publicLanding.sections.search.description')}
      >
        <DeferredLandingPreview
          load={loadSearchPreview}
          minHeight={480}
          label={t('pages.home.publicLanding.sections.search.title')}
        />
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.officialData.eyebrow')}
        title={t('pages.home.publicLanding.sections.officialData.title')}
        description={t('pages.home.publicLanding.sections.officialData.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <StoryPoints
            points={tArray('pages.home.publicLanding.sections.officialData.points')}
            icons={[Database, ShieldCheck, BarChart3]}
            stacked
          />
          <DeferredLandingPreview
            load={loadOfficialDataPreview}
            minHeight={560}
            label={t('pages.home.publicLanding.sections.officialData.title')}
          />
        </div>
      </StorySection>

      <SolutionsSection t={t} tArray={tArray} />
      <ImprintSection t={t} tArray={tArray} />
      <PublicSiteFooter />
    </div>
  );
}

type LandingTranslator = ReturnType<typeof useTranslation>['t'];
type LandingArrayTranslator = ReturnType<typeof useTranslation>['tArray'];
type StoryIcon = LucideIcon;

function StorySection({
  eyebrow,
  title,
  description,
  children,
  muted,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <LandingRevealSection className={cn('border-b', muted ? 'bg-muted/20' : 'bg-background')}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-8 space-y-6">{children}</div>
      </div>
    </LandingRevealSection>
  );
}

function StoryPoints({
  points,
  icons,
  stacked = false,
}: {
  points: string[];
  icons: StoryIcon[];
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? 'space-y-4' : 'grid gap-4 md:grid-cols-3'}>
      {points.map((point, index) => (
        <ProductStoryPoint key={point} icon={icons[index] ?? CheckCircle2} text={point} />
      ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-brand text-sm font-semibold uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="text-muted-foreground text-base leading-7">{description}</p>
    </div>
  );
}

function LandingDecisionFlow({ steps }: { steps: string[] }) {
  const flowSteps =
    steps.length >= decisionIcons.length
      ? steps.slice(0, decisionIcons.length)
      : decisionFallbackSteps;
  return (
    <div aria-hidden="true" className="max-w-2xl pt-1">
      <div className="relative grid grid-cols-3 gap-2 pt-1">
        <div className="bg-border absolute top-5 right-[16.666%] left-[16.666%] h-px" />
        <span className="landing-decision-flow-marker bg-highlight ring-highlight/20 absolute top-[0.875rem] h-3 w-3 -translate-x-1/2 rounded-full shadow-sm ring-4" />
        {flowSteps.map((step, index) => {
          const Icon = decisionIcons[index] ?? CheckCircle2;
          return (
            <div
              key={`${step}-${index}`}
              className="relative z-10 flex min-w-0 flex-col items-center gap-2"
            >
              <span
                className={cn(
                  'bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm',
                  index === flowSteps.length - 1
                    ? 'border-highlight/50 text-highlight'
                    : 'border-border text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-muted-foreground max-w-24 text-center text-xs font-semibold sm:max-w-none">
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SolutionsSection({ t, tArray }: { t: LandingTranslator; tArray: LandingArrayTranslator }) {
  return (
    <LandingRevealSection id="solutions" className="scroll-mt-24 border-b">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('pages.home.publicLanding.sections.solutions.eyebrow')}
          title={t('pages.home.publicLanding.sections.solutions.title')}
          description={t('pages.solutions.subtitle')}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {solutionKeys.map(key => (
            <Card key={key} className="h-full">
              <CardHeader className="p-5">
                <CardTitle className="text-lg">
                  {t(`pages.solutions.solutions.${key}.title`)}
                </CardTitle>
                <p className="text-brand text-sm font-medium">
                  {t(`pages.solutions.solutions.${key}.tagline`)}
                </p>
                <CardDescription leading="relaxed">
                  {t(`pages.solutions.solutions.${key}.description`)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0">
                {tArray(`pages.solutions.solutions.${key}.features`)
                  .slice(0, 3)
                  .map(feature => (
                    <div key={feature} className="text-muted-foreground flex gap-2 text-sm">
                      <CheckCircle2 className="text-success mt-0.5 h-4 w-4 flex-none" />
                      <span>{feature}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LandingRevealSection>
  );
}

function ImprintSection({ t, tArray }: { t: LandingTranslator; tArray: LandingArrayTranslator }) {
  return (
    <LandingRevealSection id="imprint" className="bg-muted/20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('pages.imprint.lastUpdated')}
          title={t('pages.imprint.title')}
          description={t('pages.imprint.subtitle')}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {imprintSectionKeys.map(key => (
            <Card key={key} className="h-full">
              <CardHeader className="p-5">
                <CardTitle className="text-lg">
                  {t(`pages.imprint.sections.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0">
                {tArray(`pages.imprint.sections.${key}.paragraphs`).map(paragraph => (
                  <p key={paragraph} className="text-muted-foreground text-sm leading-6">
                    {paragraph}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ContactLink
            href={`mailto:${SUPPORT_EMAIL}`}
            title={t('pages.imprint.contact.email.title')}
            value={SUPPORT_EMAIL}
            description={t('pages.imprint.contact.email.description')}
          />
          <ContactLink
            href={GITHUB_REPOSITORY_URL}
            title={t('pages.imprint.contact.repository.title')}
            value={GITHUB_REPOSITORY_URL}
            description={t('pages.imprint.contact.repository.description')}
            external
          />
          <ContactLink
            href="/support"
            title={t('pages.imprint.contact.support.title')}
            value="/support"
            description={t('pages.imprint.contact.support.description')}
          />
        </div>
      </div>
    </LandingRevealSection>
  );
}

function ContactLink({
  href,
  title,
  value,
  description,
  external,
}: {
  href: string;
  title: string;
  value: string;
  description: string;
  external?: boolean;
}) {
  return (
    <SmartLink
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="bg-background hover:bg-accent rounded-lg border p-5 transition-colors"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground mt-2 text-sm break-words">{value}</p>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{description}</p>
    </SmartLink>
  );
}
