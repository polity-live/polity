'use client';

import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Bike,
  Building2,
  Calendar,
  Calculator,
  CarFront,
  CheckCircle2,
  Crown,
  Database,
  FileText,
  Footprints,
  Globe2,
  Layers,
  MapPinned,
  MessageSquare,
  Network,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  TreePine,
  Users,
  Vote,
  Workflow,
} from 'lucide-react';
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
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { NetworkControlPanel } from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { createGroupNodeLegendItem } from '@/features/network/ui/networkVisualHelpers';
import { cn } from '@/features/shared/utils/utils';
import { EntitySearchBar, type FilterOption } from '@/features/shared/ui/typeahead';
import { SearchResultCard } from '@/features/search/ui/SearchResultCard';
import type { SearchDocument } from '@/features/search/types/search-document.types';
import { MessageBubble } from '@/features/messages/ui/MessageBubble';
import { ConversationHeader } from '@/features/messages/ui/ConversationHeader';
import type { Conversation, Message } from '@/features/messages/types/message.types';
import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { AgendaItemTimelineCard } from '@/features/timeline/ui/cards/AgendaItemTimelineCard';
import { AssistantMessageInput } from '@/features/messages/ui/AssistantMessageInput';
import { CivicTimelineMap } from '@/features/timeline/ui/CivicTimelineMap';
import { CivicTimelineRail } from '@/features/timeline/ui/CivicTimelineRail';
import {
  landingNetworkAlwaysVisibleNodeIds,
  landingNetworkEdges,
  landingNetworkNodes,
} from '@/features/public-landing/logic/landingNetworkPreview';
import { useLandingNetworkPreviewState } from '@/features/public-landing/hooks/useLandingNetworkPreviewState';
import { LANDING_AGENDA_ITEM_ID } from '@/features/public-landing/logic/landingAmendmentPreview';
import {
  landingActivityTimelineItems,
  landingActivityTimelineSections,
} from '@/features/public-landing/logic/landingActivityPreview';
import { ProductStoryPoint } from './ProductStoryPoint';
import { LandingAmendmentSectionContentContainer } from './LandingAmendmentSectionContent';
import { MotionGroup, MotionItem, ScrollReveal } from '@/features/shared/motion';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';

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
const landingPreviewUserId = 'landing-preview-user';
const landingDecisionFlowIcons = [FileText, Workflow, Vote] as const;
const landingDecisionFlowFallbackSteps = ['Proposal', 'Amendment', 'Vote'] as const;
type LandingAssistantChatPreview = Parameters<typeof AssistantMessageInput>[0]['assistantChat'];

function getWinningPreviewPercentage(items: { percentage: number }[]) {
  const winningPercentage = items.reduce(
    (max, item) => Math.max(max, Number.isFinite(item.percentage) ? item.percentage : 0),
    0
  );

  return winningPercentage > 0 ? winningPercentage : null;
}

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

      <section id="features" className="bg-muted/20 scroll-mt-24 border-b">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={t('pages.home.publicLanding.sections.features.eyebrow')}
            title={t('pages.home.publicLanding.sections.features.title')}
            description={t('pages.home.publicLanding.sections.features.description')}
          />
          <MotionGroup className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ key, icon: Icon }) => (
              <MotionItem key={key}>
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
              </MotionItem>
            ))}
          </MotionGroup>
        </div>
      </section>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.network.eyebrow')}
        title={t('pages.home.publicLanding.sections.network.title')}
        description={t('pages.home.publicLanding.sections.network.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            {tArray('pages.home.publicLanding.sections.network.points').map((point, index) => (
              <ProductStoryPoint
                key={point}
                icon={index === 0 ? Network : index === 1 ? Workflow : Vote}
                text={point}
              />
            ))}
          </div>
          <LandingNetworkFlowPreview />
        </div>
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.amendments.eyebrow')}
        title={t('pages.home.publicLanding.sections.amendments.title')}
        description={t('pages.home.publicLanding.sections.amendments.description')}
      >
        <LandingAmendmentSectionContentContainer />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.events.eyebrow')}
        title={t('pages.home.publicLanding.sections.events.title')}
        description={t('pages.home.publicLanding.sections.events.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-4">
            {tArray('pages.home.publicLanding.sections.events.points').map((point, index) => (
              <ProductStoryPoint
                key={point}
                icon={index === 0 ? Calendar : index === 1 ? Vote : Workflow}
                text={point}
              />
            ))}
          </div>
          <LandingAgendaTimelinePreview />
        </div>
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.votesElections.eyebrow')}
        title={t('pages.home.publicLanding.sections.votesElections.title')}
        description={t('pages.home.publicLanding.sections.votesElections.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-4">
            {tArray('pages.home.publicLanding.sections.votesElections.points').map(
              (point, index) => (
                <ProductStoryPoint
                  key={point}
                  icon={index === 0 ? Vote : index === 1 ? Users : CheckCircle2}
                  text={point}
                />
              )
            )}
          </div>
          <LandingVoteElectionPreview />
        </div>
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.officialData.eyebrow')}
        title={t('pages.home.publicLanding.sections.officialData.title')}
        description={t('pages.home.publicLanding.sections.officialData.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-4">
            {tArray('pages.home.publicLanding.sections.officialData.points').map((point, index) => (
              <ProductStoryPoint
                key={point}
                icon={index === 0 ? Database : index === 1 ? ShieldCheck : BarChart3}
                text={point}
              />
            ))}
          </div>
          <LandingOfficialDataPreview />
        </div>
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.streetDesign.eyebrow')}
        title={t('pages.home.publicLanding.sections.streetDesign.title')}
        description={t('pages.home.publicLanding.sections.streetDesign.description')}
      >
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-4">
            {tArray('pages.home.publicLanding.sections.streetDesign.points').map((point, index) => (
              <ProductStoryPoint
                key={point}
                icon={index === 0 ? MapPinned : index === 1 ? Route : Calculator}
                text={point}
              />
            ))}
          </div>
          <LandingStreetDesignPreview />
        </div>
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.social.eyebrow')}
        title={t('pages.home.publicLanding.sections.social.title')}
        description={t('pages.home.publicLanding.sections.social.description')}
      >
        <LandingSocialAiPreview />
      </StorySection>

      <StorySection
        muted
        eyebrow={t('pages.home.publicLanding.sections.timeline.eyebrow')}
        title={t('pages.home.publicLanding.sections.timeline.title')}
        description={t('pages.home.publicLanding.sections.timeline.description')}
      >
        <LandingActivityStripPreview />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.search.eyebrow')}
        title={t('pages.home.publicLanding.sections.search.title')}
        description={t('pages.home.publicLanding.sections.search.description')}
      >
        <LandingSearchPreview />
      </StorySection>

      <section id="solutions" className="scroll-mt-24 border-b">
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
      </section>

      <section id="imprint" className="bg-muted/20 scroll-mt-24">
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
      </section>

      <PublicSiteFooter />
    </div>
  );
}

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
    <ScrollReveal as="section" className={cn('border-b', muted ? 'bg-muted/20' : 'bg-background')}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-8">{children}</div>
      </div>
    </ScrollReveal>
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
    steps.length >= landingDecisionFlowIcons.length
      ? steps.slice(0, landingDecisionFlowIcons.length)
      : [...landingDecisionFlowFallbackSteps];

  return (
    <div aria-hidden="true" className="max-w-2xl pt-1">
      <div className="relative grid grid-cols-3 gap-2 pt-1">
        <div className="bg-border absolute top-5 right-[16.666%] left-[16.666%] h-px" />
        <span className="landing-decision-flow-marker bg-highlight ring-highlight/20 absolute top-[0.875rem] h-3 w-3 -translate-x-1/2 rounded-full shadow-sm ring-4" />
        {flowSteps.map((step, index) => {
          const Icon = landingDecisionFlowIcons[index] ?? CheckCircle2;
          const isFinalStep = index === flowSteps.length - 1;

          return (
            <div
              key={`${step}-${index}`}
              className="relative z-10 flex min-w-0 flex-col items-center gap-2"
            >
              <span
                className={cn(
                  'bg-background flex h-8 w-8 items-center justify-center rounded-full border shadow-sm',
                  isFinalStep
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

export function LandingNetworkFlowPreview() {
  const { t } = useTranslation();
  const translateRelationship = useCallback(
    (key: string, fallback?: string) => t(key, fallback),
    [t]
  );
  const {
    visibleNodes,
    visibleEdges,
    selectedRights,
    selectedConnectionDirections,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    dialogOpen,
    setDialogOpen,
    selectedEntity,
    toggleRight,
    toggleConnectionDirection,
    onNodeClick,
    onEdgeClick,
  } = useLandingNetworkPreviewState({
    nodes: landingNetworkNodes,
    edges: landingNetworkEdges,
    alwaysVisibleNodeIds: landingNetworkAlwaysVisibleNodeIds,
    translateRelationship,
  });

  return (
    <LandingNetworkFlowPreviewView
      dialogOpen={dialogOpen}
      legendCollapsed={legendCollapsed}
      onEdgeClick={onEdgeClick}
      onNodeClick={onNodeClick}
      panelCollapsed={panelCollapsed}
      selectedConnectionDirections={selectedConnectionDirections}
      selectedEntity={selectedEntity}
      selectedRights={selectedRights}
      setDialogOpen={setDialogOpen}
      setLegendCollapsed={setLegendCollapsed}
      setPanelCollapsed={setPanelCollapsed}
      t={t}
      toggleConnectionDirection={toggleConnectionDirection}
      toggleRight={toggleRight}
      visibleEdges={visibleEdges}
      visibleNodes={visibleNodes}
    />
  );
}

function LandingNetworkFlowPreviewView({
  dialogOpen,
  legendCollapsed,
  onEdgeClick,
  onNodeClick,
  panelCollapsed,
  selectedConnectionDirections,
  selectedEntity,
  selectedRights,
  setDialogOpen,
  setLegendCollapsed,
  setPanelCollapsed,
  t,
  toggleConnectionDirection,
  toggleRight,
  visibleEdges,
  visibleNodes,
}: {
  dialogOpen: boolean;
  legendCollapsed: boolean;
  onEdgeClick: (event: any, edge: any) => void;
  onNodeClick: (event: any, node: any) => void;
  panelCollapsed: boolean;
  selectedConnectionDirections: Set<string>;
  selectedEntity: any;
  selectedRights: Set<string>;
  setDialogOpen: (open: boolean) => void;
  setLegendCollapsed: (collapsed: boolean) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  t: (key: string, fallback?: string) => string;
  toggleConnectionDirection: (direction: any) => void;
  toggleRight: (right: string) => void;
  visibleEdges: any[];
  visibleNodes: any[];
}) {
  return (
    <div className="landing-network-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t('pages.home.publicLanding.network.title')}</p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.network.description')}
            </p>
          </div>
        </div>
      </div>
      <NetworkFlowBase
        nodes={visibleNodes}
        edges={visibleEdges}
        nodesDraggable={false}
        nodesFocusable
        nodesConnectable={false}
        edgesFocusable
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        containerClassName="h-[34rem] min-h-[30rem] rounded-none border-0"
        miniMapProps={{
          position: 'bottom-right',
          nodeBorderRadius: 8,
          nodeColor: node =>
            node.data?.kind === 'event'
              ? featureThemeValue('publiclandingLandingNetworkPreviewTealColor')
              : String(
                  (node.style as { background?: string } | undefined)?.background ??
                    featureThemeValue('publiclandingPublicLandingPageNeutralColor')
                ),
          nodeStrokeColor: node =>
            node.data?.kind === 'event'
              ? featureThemeValue('publiclandingPublicLandingPageTealColor')
              : featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta'),
          maskColor: featureThemeClassName('publiclandingPublicLandingPageThemedStyleAlpha'),
          style: {
            width: 170,
            height: 118,
          },
        }}
        panel={
          <NetworkControlPanel
            title={t('pages.home.publicLanding.network.panelTitle')}
            description={t('pages.home.publicLanding.network.description')}
            panelCollapsed={panelCollapsed}
            onPanelCollapsedChange={setPanelCollapsed}
            legendCollapsed={legendCollapsed}
            onLegendCollapsedChange={setLegendCollapsed}
            legendTitle={t('common.network.legend')}
            legendItems={[
              createGroupNodeLegendItem({
                id: 'state-party',
                label: t('common.network.parentGroup'),
                visualVariant: 'parent',
              }),
              createGroupNodeLegendItem({
                id: 'local-branch',
                label: t('common.network.currentGroup'),
                visualVariant: 'current',
              }),
              createGroupNodeLegendItem({
                id: 'policy-committee',
                label: t('common.network.childGroup'),
                visualVariant: 'child',
              }),
              createGroupNodeLegendItem({
                id: 'party-congress',
                label: t('common.network.siblingGroupElected'),
                visualVariant: 'sibling-elected',
              }),
              createGroupNodeLegendItem({
                id: 'parliamentary-group',
                label: t('common.network.siblingGroupParliament'),
                visualVariant: 'sibling-parliament',
              }),
              {
                id: 'events',
                label: t('common.labels.eventDetails'),
                swatchClassName: featureThemeClassName('publiclandingPublicLandingPageTealSurface'),
              },
            ]}
            showDisplayControls={false}
            showInteractiveToggle={false}
            isInteractive
            onInteractiveChange={() => undefined}
            showRightsFilter
            selectedRights={selectedRights}
            onToggleRight={toggleRight}
            connectionDirectionFilters={[
              {
                id: 'incoming',
                label: t('common.network.incomingConnections'),
                active: selectedConnectionDirections.has('incoming'),
                onToggle: () => toggleConnectionDirection('incoming'),
              },
              {
                id: 'outgoing',
                label: t('common.network.outgoingConnections'),
                active: selectedConnectionDirections.has('outgoing'),
                onToggle: () => toggleConnectionDirection('outgoing'),
              },
            ]}
            showConnectionDirectionLegend
            connectionDirectionLegendTitle={t('common.network.connectionDirections')}
            bidirectionalConnectionLabel={t('common.network.bidirectional')}
            incomingConnectionLabel={t('common.network.incomingConnections')}
            outgoingConnectionLabel={t('common.network.outgoingConnections')}
            showRightsLegend
          />
        }
      >
        <NetworkEntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entity={selectedEntity}
        />
      </NetworkFlowBase>
    </div>
  );
}

type LandingOfficialDataPhase = 'typing' | 'results' | 'selected' | 'data';

const landingOfficialDataProviderKeys = ['eurostat', 'govdata', 'destatis'] as const;
const landingOfficialDataProviderIcons = [Globe2, Database, Building2] as const;
const landingOfficialDataChartBars = [42, 64, 56, 82, 70] as const;
const landingOfficialDataSelectedResultIndex = 1;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();

    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function LandingOfficialDataPreview() {
  const { t, tArray } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const searchQuery = t('pages.home.publicLanding.officialDataPreview.query');
  const resultTitles = tArray('pages.home.publicLanding.officialDataPreview.resultTitles');
  const resultSources = tArray('pages.home.publicLanding.officialDataPreview.resultSources');
  const resultMeta = tArray('pages.home.publicLanding.officialDataPreview.resultMeta');
  const resultProviders = tArray('pages.home.publicLanding.officialDataPreview.resultProviders');
  const tableColumns = tArray('pages.home.publicLanding.officialDataPreview.tableColumns');
  const tableRows = tArray('pages.home.publicLanding.officialDataPreview.tableRows').map(row =>
    row.split('|').map(cell => cell.trim())
  );
  const metrics = tArray('pages.home.publicLanding.officialDataPreview.metrics');
  const chartLabels = tArray('pages.home.publicLanding.officialDataPreview.chartLabels');
  const [phase, setPhase] = useState<LandingOfficialDataPhase>('typing');
  const [typedLength, setTypedLength] = useState(0);
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase('data');
      setTypedLength(searchQuery.length);
      return;
    }

    const timers: number[] = [];
    const typeStepMs = 48;
    const typeStartDelayMs = 320;
    const typedDurationMs = typeStartDelayMs + searchQuery.length * typeStepMs;

    setPhase('typing');
    setTypedLength(0);

    for (let index = 0; index < searchQuery.length; index += 1) {
      timers.push(
        window.setTimeout(() => setTypedLength(index + 1), typeStartDelayMs + index * typeStepMs)
      );
    }

    timers.push(window.setTimeout(() => setPhase('results'), typedDurationMs + 360));
    timers.push(window.setTimeout(() => setPhase('selected'), typedDurationMs + 1720));
    timers.push(window.setTimeout(() => setPhase('data'), typedDurationMs + 2880));
    timers.push(
      window.setTimeout(() => setAnimationCycle(cycle => cycle + 1), typedDurationMs + 7600)
    );

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [animationCycle, prefersReducedMotion, searchQuery]);

  const typedQuery = phase === 'typing' ? searchQuery.slice(0, typedLength) : searchQuery;
  const hasResults = phase === 'results' || phase === 'selected' || phase === 'data';
  const hasSelection = phase === 'selected' || phase === 'data';
  const hasData = phase === 'data';
  const activeStatus = prefersReducedMotion ? 'data' : phase;
  const motionClassName = prefersReducedMotion ? '' : 'transition-all duration-500 ease-out';

  return (
    <div className="landing-official-data-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.officialDataPreview.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.officialDataPreview.subtitle')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {t(`pages.home.publicLanding.officialDataPreview.statuses.${activeStatus}`)}
          </BadgeControl>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="bg-background flex h-12 min-w-0 items-center gap-3 rounded-md border px-3">
          <Search className="text-muted-foreground h-4 w-4 flex-none" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {typedQuery || (
              <span className="text-muted-foreground">
                {t('pages.home.publicLanding.officialDataPreview.searchPlaceholder')}
              </span>
            )}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              'bg-brand h-5 w-px flex-none',
              phase === 'typing' && !prefersReducedMotion && 'animate-pulse'
            )}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {landingOfficialDataProviderKeys.map((providerKey, index) => {
            const Icon = landingOfficialDataProviderIcons[index] ?? Database;
            const isActive = providerKey === 'govdata' || (hasData && providerKey === 'destatis');

            return (
              <div
                key={providerKey}
                className={cn(
                  'flex min-h-24 flex-col justify-between rounded-md border p-3',
                  isActive ? 'border-brand/40 bg-brand/10' : 'bg-background',
                  motionClassName
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 flex-none items-center justify-center rounded-md border',
                      isActive
                        ? 'border-brand/40 bg-background text-brand'
                        : 'bg-muted/20 text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {t(`pages.home.publicLanding.officialDataPreview.providers.${providerKey}`)}
                  </span>
                </div>
                <span className="text-muted-foreground mt-2 text-xs leading-5">
                  {t(`pages.home.publicLanding.officialDataPreview.providerHints.${providerKey}`)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.86fr]">
          <div className="bg-background min-h-[22rem] overflow-hidden rounded-md border">
            <div className="border-b px-3 py-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
                <Database className="h-3.5 w-3.5" />
                {t('pages.home.publicLanding.officialDataPreview.resultsTitle')}
              </div>
            </div>
            <div className="space-y-2 p-3">
              {resultTitles.map((title, index) => {
                const isSelected = hasSelection && index === landingOfficialDataSelectedResultIndex;

                return (
                  <div
                    key={title}
                    className={cn(
                      'grid min-h-[5.75rem] gap-2 rounded-md border px-3 py-3 sm:grid-cols-[1fr_auto]',
                      hasResults ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                      isSelected
                        ? 'border-brand/50 bg-brand/10 ring-brand/20 ring-2'
                        : 'bg-muted/20',
                      motionClassName
                    )}
                    style={{
                      transitionDelay:
                        hasResults && !prefersReducedMotion ? `${index * 110}ms` : undefined,
                    }}
                    aria-hidden={!hasResults}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {resultSources[index] ?? ''}
                      </p>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                        {resultMeta[index] ?? ''}
                      </p>
                    </div>
                    <div className="flex items-start justify-start sm:justify-end">
                      <BadgeControl
                        variant={isSelected ? 'secondary' : 'outline'}
                        size="tiny"
                        className="max-w-full"
                      >
                        {isSelected
                          ? t('pages.home.publicLanding.officialDataPreview.selectedLabel')
                          : (resultProviders[index] ?? '')}
                      </BadgeControl>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              'bg-background min-h-[22rem] space-y-3 rounded-md border p-3',
              hasData ? 'opacity-100' : 'opacity-45',
              motionClassName
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {t('pages.home.publicLanding.officialDataPreview.dataTitle')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('pages.home.publicLanding.officialDataPreview.dataSubtitle')}
                </p>
              </div>
              <BarChart3 className="text-brand h-5 w-5 flex-none" />
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/20 grid grid-cols-3 gap-2 border-b px-3 py-2 text-xs font-semibold">
                {tableColumns.map(column => (
                  <span key={column} className="truncate">
                    {column}
                  </span>
                ))}
              </div>
              <div className="divide-y">
                {tableRows.map((row, rowIndex) => (
                  <div
                    key={`${row.join('-')}-${rowIndex}`}
                    className={cn(
                      'grid min-h-10 grid-cols-3 gap-2 px-3 py-2 text-xs',
                      hasData ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                      motionClassName
                    )}
                    style={{
                      transitionDelay:
                        hasData && !prefersReducedMotion ? `${rowIndex * 90}ms` : undefined,
                    }}
                  >
                    {tableColumns.map((column, columnIndex) => (
                      <span
                        key={`${column}-${columnIndex}`}
                        className={cn(
                          columnIndex === 1 ? 'font-semibold' : 'text-muted-foreground'
                        )}
                      >
                        {row[columnIndex] ?? ''}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t('pages.home.publicLanding.officialDataPreview.chartTitle')}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.home.publicLanding.officialDataPreview.chartSubtitle')}
                  </p>
                </div>
              </div>
              <div className="bg-muted/20 flex h-32 items-end gap-2 rounded-md border px-3 pt-4 pb-3">
                {landingOfficialDataChartBars.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className={cn(
                        'w-full max-w-10 rounded-t-md',
                        index === 3 ? 'bg-brand' : 'bg-brand/35'
                      )}
                      style={{
                        height: `${hasData ? height : 8}%`,
                        transition: prefersReducedMotion
                          ? undefined
                          : `height 620ms ease ${index * 80}ms`,
                      }}
                    />
                    <span className="text-muted-foreground max-w-full truncate text-[10px] font-medium">
                      {chartLabels[index] ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {metrics.map(metric => (
                <div
                  key={metric}
                  className={cn(
                    'bg-muted/20 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium',
                    hasData ? 'opacity-100' : 'opacity-50',
                    motionClassName
                  )}
                >
                  <CheckCircle2 className="text-success h-3.5 w-3.5 flex-none" />
                  <span className="min-w-0 truncate">{metric}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const landingStreetDesignToolIcons = [Route, Bike, Footprints, TreePine, Sprout] as const;
const landingStreetDesignLayerIcons = [Route, Building2, Sprout] as const;

export function LandingStreetDesignPreview() {
  const { t, tArray } = useTranslation();
  const tools = tArray('pages.home.publicLanding.streetDesignPreview.tools');
  const layers = tArray('pages.home.publicLanding.streetDesignPreview.layers');
  const comparisonModes = tArray('pages.home.publicLanding.streetDesignPreview.comparisonModes');
  const metrics = tArray('pages.home.publicLanding.streetDesignPreview.metrics');

  return (
    <div className="landing-street-design-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.streetDesignPreview.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.streetDesignPreview.subtitle')}
            </p>
          </div>
          <BadgeControl variant="outline">
            {t('pages.home.publicLanding.streetDesignPreview.badge')}
          </BadgeControl>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-5 border-b p-4 lg:border-r lg:border-b-0">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Route className="text-muted-foreground h-4 w-4" />
              {t('pages.home.publicLanding.streetDesignPreview.toolsTitle')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool, index) => {
                const Icon = landingStreetDesignToolIcons[index] ?? Route;
                const isActive = index === 1 || index === 3;

                return (
                  <div
                    key={tool}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-2 text-center text-[11px] leading-tight',
                      isActive
                        ? 'border-brand/40 bg-brand/10 text-brand'
                        : 'bg-background text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="max-w-full truncate">{tool}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground h-4 w-4" />
              {t('pages.home.publicLanding.streetDesignPreview.layersTitle')}
            </div>
            <div className="space-y-2">
              {layers.map((layer, index) => {
                const Icon = landingStreetDesignLayerIcons[index] ?? Layers;

                return (
                  <div
                    key={layer}
                    className="bg-muted/20 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="text-muted-foreground h-3.5 w-3.5 flex-none" />
                      <span className="truncate">{layer}</span>
                    </span>
                    <span className="bg-success h-2 w-2 flex-none rounded-full" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div
            role="img"
            aria-label={t('pages.home.publicLanding.streetDesignPreview.canvasLabel')}
            className="from-background via-muted/30 to-muted/60 relative min-h-[22rem] overflow-hidden rounded-md border bg-gradient-to-br"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(20,184,166,0.18),transparent_22%),radial-gradient(circle_at_82%_12%,rgba(234,179,8,0.16),transparent_20%),linear-gradient(135deg,transparent_0%,transparent_58%,rgba(15,23,42,0.08)_58%,rgba(15,23,42,0.08)_59%,transparent_59%)]" />
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 h-64 w-[34rem] max-w-[92%] rounded-xl border border-white/50 bg-stone-200 shadow-2xl"
              style={{
                transform: 'translate(-50%, -50%) rotateX(58deg) rotateZ(-28deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="absolute inset-y-0 left-6 w-16 rounded-l-xl bg-emerald-100" />
              <div className="absolute inset-y-0 right-6 w-14 rounded-r-xl bg-lime-100" />
              <div className="absolute top-1/2 right-20 left-20 h-28 -translate-y-1/2 rounded-md bg-zinc-700 shadow-inner" />
              <div className="absolute top-1/2 right-20 left-20 h-px -translate-y-1/2 border-t border-dashed border-white/70" />
              <div className="absolute top-[4.9rem] right-20 left-20 h-8 rounded-sm bg-sky-500/80" />
              <div className="absolute top-[5.9rem] right-20 left-20 h-px border-t border-dashed border-white/80" />
              <div className="absolute top-[9.9rem] right-20 left-20 h-9 rounded-sm bg-neutral-300" />
              <div className="absolute top-[10.8rem] right-20 left-20 h-px border-t border-dashed border-zinc-500/50" />
              <div className="absolute top-9 left-28 h-10 w-16 rounded-sm bg-zinc-500/30 shadow-sm" />
              <div className="absolute right-24 bottom-9 h-12 w-20 rounded-sm bg-zinc-500/25 shadow-sm" />
              {[0, 1, 2, 3, 4, 5].map(index => (
                <span
                  key={index}
                  className="absolute h-5 w-5 rounded-full bg-emerald-600 shadow-md ring-2 ring-emerald-200"
                  style={{
                    left: `${16 + index * 12}%`,
                    top: index % 2 === 0 ? '18%' : '70%',
                  }}
                />
              ))}
              <div className="absolute right-8 bottom-12 h-20 w-16 rounded-sm bg-teal-500/40" />
              <div className="absolute top-12 left-8 h-24 w-12 rounded-sm bg-amber-300/50" />
            </div>

            <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2">
              {metrics.map(metric => (
                <span
                  key={metric}
                  className="bg-background/90 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur"
                >
                  {metric}
                </span>
              ))}
            </div>

            <div className="bg-background/90 absolute bottom-4 left-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur">
              <CarFront className="text-muted-foreground h-3.5 w-3.5" />
              {comparisonModes[1] ?? t('pages.home.publicLanding.streetDesignPreview.badge')}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[0.86fr_1.14fr]">
            <div className="bg-background rounded-md border p-3">
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium uppercase">
                <Calculator className="h-3.5 w-3.5" />
                {t('pages.home.publicLanding.streetDesignPreview.costTitle')}
              </div>
              <p className="text-xl font-semibold">
                {t('pages.home.publicLanding.streetDesignPreview.totalCost')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('pages.home.publicLanding.streetDesignPreview.estimate')}
              </p>
            </div>

            <div className="bg-background rounded-md border p-3">
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium uppercase">
                <Layers className="h-3.5 w-3.5" />
                {t('pages.home.publicLanding.streetDesignPreview.comparisonTitle')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {comparisonModes.map((mode, index) => (
                  <div
                    key={mode}
                    className={cn(
                      'rounded-md border px-2 py-2 text-center text-xs font-medium',
                      index === 2 ? 'border-brand/40 bg-brand/10 text-brand' : 'bg-muted/20'
                    )}
                  >
                    {mode}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingAgendaTimelinePreview() {
  const { t } = useTranslation();
  const agendaTimelineItems = [
    {
      id: LANDING_AGENDA_ITEM_ID,
      title: t('pages.home.publicLanding.timeline.items.event.title'),
      description: t('pages.home.publicLanding.timeline.items.event.description'),
      type: 'discussion',
      status: 'planned',
      orderIndex: 18,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 8, 30)),
      durationMinutes: 45,
      eventName: 'Budget Committee',
    },
    {
      id: `${LANDING_AGENDA_ITEM_ID}-review`,
      title: t('pages.home.publicLanding.timeline.items.changeRequest.title'),
      description: t('pages.home.publicLanding.timeline.items.changeRequest.description'),
      type: 'amendment',
      status: 'in-progress',
      orderIndex: 19,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 9, 30)),
      durationMinutes: 30,
      eventName: 'Budget Committee',
    },
    {
      id: `${LANDING_AGENDA_ITEM_ID}-vote`,
      title: t('pages.home.publicLanding.timeline.items.vote.title'),
      description: t('pages.home.publicLanding.timeline.items.vote.description'),
      type: 'vote',
      status: 'pending',
      orderIndex: 20,
      scheduledTime: new Date(Date.UTC(2026, 5, 18, 10, 15)),
      durationMinutes: 20,
      eventName: 'Budget Committee',
    },
  ];

  return (
    <div className="landing-agenda-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('pages.home.publicLanding.timeline.title')}</p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.timeline.description')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BadgeControl variant="outline">
              {t('pages.home.publicLanding.timeline.badge')}
            </BadgeControl>
            <BadgeControl variant="secondary" size="tiny" textStyle="mono">
              {LANDING_AGENDA_ITEM_ID}
            </BadgeControl>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="landing-agenda-timeline before:bg-border relative space-y-4 pl-6 before:absolute before:top-3 before:bottom-3 before:left-2 before:w-px">
          {agendaTimelineItems.map((item, index) => (
            <div key={item.id} className="landing-agenda-step relative">
              <span className="landing-timeline-dot border-background bg-brand absolute top-5 -left-[22px] h-3 w-3 rounded-full border-2 shadow-sm" />
              <AgendaItemTimelineCard
                agendaItem={item}
                className={cn('landing-agenda-card', index === 0 && 'ring-brand/30 ring-2')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingVoteElectionPreview() {
  const { t, tArray } = useTranslation();
  const voteChoices = tArray('pages.home.publicLanding.voteElectionPreview.voteChoices').map(
    choice => {
      const [label = '', count = '', percentage = '0'] = choice.split('|');
      const parsedPercentage = Number.parseInt(percentage, 10);

      return {
        label,
        count,
        percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : 0,
      };
    }
  );
  const winningVotePercentage = getWinningPreviewPercentage(voteChoices);
  const electionCandidates = tArray(
    'pages.home.publicLanding.voteElectionPreview.electionCandidates'
  ).map(candidate => {
    const [name = '', role = '', count = '', percentage = '0'] = candidate.split('|');
    const parsedPercentage = Number.parseInt(percentage, 10);

    return {
      name,
      role,
      count,
      percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : 0,
    };
  });
  const winningCandidatePercentage = getWinningPreviewPercentage(electionCandidates);
  const metrics = tArray('pages.home.publicLanding.voteElectionPreview.metrics');
  const checklist = tArray('pages.home.publicLanding.voteElectionPreview.checklist');
  const winnerLabel = t('features.events.agenda.winner', 'Winner');

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.voteElectionPreview.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.voteElectionPreview.subtitle')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            <Vote className="mr-1.5 h-3.5 w-3.5" />
            {t('pages.home.publicLanding.voteElectionPreview.badge')}
          </BadgeControl>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {t('pages.home.publicLanding.voteElectionPreview.voteTitle')}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t('pages.home.publicLanding.voteElectionPreview.voteMeta')}
                </p>
              </div>
              <Calendar className="text-brand h-5 w-5 flex-none" />
            </div>

            <div className="space-y-3">
              {voteChoices.map((choice, index) => {
                const isWinner =
                  winningVotePercentage !== null && choice.percentage === winningVotePercentage;

                return (
                  <div
                    key={choice.label}
                    className={cn(
                      'space-y-1.5 transition-[background-color,border-color,box-shadow]',
                      isWinner &&
                        'bg-card rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-3 shadow-sm'
                    )}
                    data-slot="landing-vote-choice"
                    data-winner={isWinner ? 'true' : undefined}
                    data-framed={isWinner ? 'true' : undefined}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 truncate font-medium">{choice.label}</span>
                        {isWinner ? (
                          <BadgeControl tone="success" size="tiny" className="gap-1">
                            <Crown className="h-3.5 w-3.5" />
                            {winnerLabel}
                          </BadgeControl>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground flex-none">
                        {choice.count} · {choice.percentage}%
                      </span>
                    </div>
                    <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
                      <div
                        data-slot="landing-vote-choice-bar"
                        className={cn(
                          'h-full rounded-full',
                          isWinner
                            ? 'bg-[var(--badge-success-fg)]'
                            : index === 0
                              ? 'bg-brand'
                              : 'bg-brand/35'
                        )}
                        style={{ width: `${choice.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 border-t pt-4 sm:grid-cols-3">
            {metrics.map(metric => (
              <div key={metric} className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
                {metric}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="bg-card rounded-lg border p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {t('pages.home.publicLanding.voteElectionPreview.electionTitle')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('pages.home.publicLanding.voteElectionPreview.electionMeta')}
              </p>
            </div>
            <Users className="text-brand h-5 w-5 flex-none" />
          </div>

          <div className="space-y-3">
            {electionCandidates.map(candidate => {
              const isWinner =
                winningCandidatePercentage !== null &&
                candidate.percentage === winningCandidatePercentage;

              return (
                <div
                  key={candidate.name}
                  className={cn(
                    'space-y-2 transition-[background-color,border-color,box-shadow]',
                    isWinner &&
                      'bg-card rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-3 shadow-sm'
                  )}
                  data-slot="landing-election-candidate"
                  data-winner={isWinner ? 'true' : undefined}
                  data-framed={isWinner ? 'true' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-brand/10 text-brand flex h-9 w-9 flex-none items-center justify-center rounded-md text-sm font-semibold">
                      {candidate.name
                        .split(' ')
                        .map(part => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{candidate.name}</p>
                        {isWinner ? (
                          <BadgeControl tone="success" size="tiny" className="gap-1">
                            <Crown className="h-3.5 w-3.5" />
                            {winnerLabel}
                          </BadgeControl>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">{candidate.role}</p>
                    </div>
                    <span className="text-muted-foreground flex-none text-xs">
                      {candidate.count} · {candidate.percentage}%
                    </span>
                  </div>
                  <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                    <div
                      data-slot="landing-election-candidate-bar"
                      className={cn(
                        'h-full rounded-full',
                        isWinner ? 'bg-[var(--badge-success-fg)]' : 'bg-brand/70'
                      )}
                      style={{ width: `${candidate.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-brand h-5 w-5" />
            <p className="font-semibold">
              {t('pages.home.publicLanding.voteElectionPreview.statusTitle')}
            </p>
          </div>
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item} className="flex gap-2 text-sm">
                <CheckCircle2 className="text-success mt-0.5 h-4 w-4 flex-none" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingSocialAiPreview() {
  const { t } = useTranslation();
  const conversation = useMemo<Conversation>(
    () =>
      ({
        id: 'landing-ai-conversation',
        type: 'direct',
        status: 'accepted',
        name: t('pages.home.publicLanding.social.aiTitle'),
        pinned: true,
        assistant_for_user_id: landingPreviewUserId,
        participants: [
          {
            id: 'landing-current-user-participant',
            user_id: landingPreviewUserId,
            unread_count: 0,
            user: {
              id: landingPreviewUserId,
              first_name: 'Jonas',
              last_name: 'Parliamentary group',
              handle: 'jonas',
              avatar: null,
            },
          },
          {
            id: 'landing-ai-participant',
            user_id: ARIA_KAI_USER_ID,
            unread_count: 0,
            user: {
              id: ARIA_KAI_USER_ID,
              first_name: 'Aria',
              last_name: 'Kai',
              handle: 'aria-kai',
              avatar: null,
            },
          },
        ],
        messages: [],
      }) as unknown as Conversation,
    [t]
  );
  const messages = useMemo<Message[]>(
    () =>
      [
        {
          id: 'landing-message-1',
          conversation_id: conversation.id,
          sender_id: landingPreviewUserId,
          content: t('pages.home.publicLanding.social.aiPrompt'),
          created_at: Date.now() - 1000 * 60 * 9,
          context_json: null,
          is_read: true,
          sender: {
            id: landingPreviewUserId,
            first_name: 'Jonas',
            last_name: 'Parliamentary group',
            handle: 'jonas',
            avatar: null,
          },
        },
        {
          id: 'landing-message-2',
          conversation_id: conversation.id,
          sender_id: ARIA_KAI_USER_ID,
          content: `${t('pages.home.publicLanding.social.aiResponseTitle')}\n${t('pages.home.publicLanding.social.aiResponse')}`,
          created_at: Date.now() - 1000 * 60 * 7,
          context_json: null,
          is_read: true,
          sender: {
            id: ARIA_KAI_USER_ID,
            first_name: 'Aria',
            last_name: 'Kai',
            handle: 'aria-kai',
            avatar: null,
          },
        },
        {
          id: 'landing-message-3',
          conversation_id: conversation.id,
          sender_id: 'landing-local-branch',
          content: t('pages.home.publicLanding.social.messages.third.body'),
          created_at: Date.now() - 1000 * 60 * 3,
          context_json: null,
          is_read: true,
          sender: {
            id: 'landing-local-branch',
            first_name: 'Local',
            last_name: 'branch north',
            handle: 'branch-north',
            avatar: null,
          },
        },
      ] as unknown as Message[],
    [conversation.id, t]
  );
  const assistantChat = useMemo<LandingAssistantChatPreview>(() => {
    const model = {
      provider: 'openai',
      id: 'gpt-4.1-mini',
      label: translateText('generated.inline.0495_gpt_4_1_mini_14652a67'),
      source: 'app',
      free: false,
      supports_reasoning_effort: true,
      context_window: 128000,
    };
    const tools = [
      {
        name: 'search_polity_entities',
        label: t('features.messages.ai.searchToolGroup'),
        kind: 'search',
        description: translateText(
          'generated.inline.0496_find_amendments_events_groups_and_agenda_item_06723b3d'
        ),
        enabled: true,
      },
      {
        name: 'create_agenda_item',
        label: t('features.events.agenda.createItem'),
        kind: 'create',
        description: translateText(
          'generated.inline.0497_prepare_a_structured_agenda_item_from_the_cur_64bd1d1d'
        ),
        enabled: true,
      },
    ];
    const skills = [
      {
        slug: 'amendment-drafting',
        name: t('pages.home.publicLanding.social.aiTitle'),
        aliases: ['motion-review', 'policy-wording'],
        isBuiltIn: true,
        systemPrompt: 'Review political amendments and produce neutral procedural wording.',
        enabled: true,
      },
    ];
    const noop = () => undefined;

    return {
      models: [model],
      isCatalogLoading: false,
      refreshCatalog: async () => undefined,
      selectedModel: model,
      selectedModelKey: 'openai:gpt-4.1-mini',
      setSelectedModelKey: noop,
      reasoningEffort: 'medium',
      setReasoningEffort: noop,
      availableTools: tools,
      selectedTools: tools,
      selectedToolNames: tools.map(tool => tool.name),
      setToolSelection: noop,
      setToolGroupSelection: noop,
      toggleSelectedToolName: noop,
      availableSkills: skills,
      selectedSkills: skills,
      selectedSkillSlugs: skills.map(skill => skill.slug),
      setSkillSelection: noop,
      toggleSelectedSkillSlug: noop,
      selectedAttachments: [],
      attachmentOptions: [],
      resolveAttachmentCardData: async () => null,
      addAttachment: noop,
      removeAttachment: noop,
      clearAttachments: noop,
      addUploadedFiles: async () => undefined,
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      createSkill: ({ slug, name }: { slug?: string; name: string }) => slug || name,
      sendAssistantMessage: async () => true,
      streamingText: '',
      streamError: null,
      isSending: false,
      isCompressing: false,
      isThinking: false,
      isToolCalling: false,
      activeToolName: null,
      activeToolCall: null,
    } as unknown as LandingAssistantChatPreview;
  }, [t]);

  return (
    <div className="landing-social-ai-preview bg-card grid gap-5 rounded-lg border p-5 shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
      <Card className="h-full min-w-0 overflow-hidden">
        <CardHeader separator className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('pages.home.publicLanding.social.chatTitle')}
              </CardTitle>
              <CardDescription>{t('pages.home.publicLanding.social.chatSubtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <MessageBubble
            message={
              {
                id: 'landing-chat-1',
                sender_id: 'landing-policy-lead',
                content: t('pages.home.publicLanding.social.messages.first.body'),
                created_at: Date.now() - 1000 * 60 * 12,
                context_json: null,
                is_read: true,
                sender: {
                  id: 'landing-policy-lead',
                  first_name: 'Maya',
                  last_name: 'Policy lead',
                  avatar: null,
                },
              } as unknown as Message
            }
            isOwnMessage={false}
          />
          <MessageBubble
            message={
              {
                id: 'landing-chat-2',
                sender_id: landingPreviewUserId,
                content: t('pages.home.publicLanding.social.messages.second.body'),
                created_at: Date.now() - 1000 * 60 * 10,
                context_json: null,
                is_read: true,
                sender: {
                  id: landingPreviewUserId,
                  first_name: 'Jonas',
                  last_name: 'Parliamentary group',
                  avatar: null,
                },
              } as unknown as Message
            }
            isOwnMessage
          />
        </CardContent>
      </Card>

      <Card className="landing-ai-conversation-card h-full min-w-0 overflow-hidden">
        <ConversationHeader
          conversation={conversation}
          currentUserId={landingPreviewUserId}
          isOnline={false}
          onBack={() => undefined}
          onTogglePin={() => undefined}
          onDeleteClick={() => undefined}
          onMembersClick={() => undefined}
          onRenameConversation={async () => true}
        />
        <CardContent className="space-y-4 p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Sparkles className="landing-ai-spark text-brand h-4 w-4" />
            {t('pages.home.publicLanding.social.aiSubtitle')}
          </div>
          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender?.id === landingPreviewUserId}
            />
          ))}
        </CardContent>
        <AssistantMessageInput assistantChat={assistantChat} />
      </Card>
    </div>
  );
}

export function LandingActivityStripPreview() {
  const { t } = useTranslation();
  const [activeItemId, setActiveItemId] = useState<string | null>('landing-activity-hearing');

  return (
    <LandingActivityStripPreviewView
      activeItemId={activeItemId}
      mappedCountLabel={t('features.timeline.around.mappedCount', {
        count: landingActivityTimelineItems.length,
        defaultValue: '{{count}} mapped',
      })}
      onActiveItemChange={setActiveItemId}
      timelineBadge={t('pages.home.publicLanding.timeline.badge')}
    />
  );
}

function LandingActivityStripPreviewView({
  activeItemId,
  mappedCountLabel,
  onActiveItemChange,
  timelineBadge,
}: {
  activeItemId: string | null;
  mappedCountLabel: string;
  onActiveItemChange: (itemId: string | null) => void;
  timelineBadge: string;
}) {
  return (
    <div className="bg-card space-y-4 rounded-lg border p-5 shadow-sm">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <BadgeControl variant="outline" shape="rounded">
          <MapPinned className="mr-1.5 h-3.5 w-3.5" />
          {mappedCountLabel}
        </BadgeControl>
        <BadgeControl variant="outline" shape="rounded">
          {timelineBadge}
        </BadgeControl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
        <div className="[&_.leaflet-container]:!h-80">
          <CivicTimelineMap
            items={landingActivityTimelineItems}
            activeItemId={activeItemId}
            onActiveItemChange={onActiveItemChange}
            onItemSelect={item => onActiveItemChange(item.id)}
          />
        </div>
        <CivicTimelineRail
          sections={landingActivityTimelineSections}
          activeItemId={activeItemId}
          onActiveItemChange={onActiveItemChange}
          onItemSelect={item => onActiveItemChange(item.id)}
        />
      </div>
    </div>
  );
}

export function LandingSearchPreview() {
  const { t, tArray } = useTranslation();
  const searchPreviewQuery = t('pages.home.publicLanding.searchPreview.query');
  const [query, setQuery] = useState('');
  const [typingCycle, setTypingCycle] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    const startDelayMs = 520;
    const typeStepMs = 54;
    const visibleHoldMs = 3600;
    const resetPauseMs = 520;

    setQuery('');

    for (let index = 0; index < searchPreviewQuery.length; index += 1) {
      timers.push(
        window.setTimeout(
          () => {
            setQuery(searchPreviewQuery.slice(0, index + 1));
          },
          startDelayMs + index * typeStepMs
        )
      );
    }

    timers.push(
      window.setTimeout(
        () => {
          setTypingCycle(cycle => cycle + 1);
        },
        startDelayMs + searchPreviewQuery.length * typeStepMs + visibleHoldMs + resetPauseMs
      )
    );

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [searchPreviewQuery, typingCycle]);

  const filters = useMemo<FilterOption[]>(
    () =>
      tArray('pages.home.publicLanding.searchPreview.filters').map((filter, index) => ({
        label: filter,
        value: filter.toLowerCase(),
        active: index < 3,
      })),
    [tArray]
  );
  const documents = useMemo<SearchDocument[]>(
    () =>
      tArray('pages.home.publicLanding.searchPreview.results').map((result, index) => ({
        id: `landing-search-${index}`,
        entity_type: 'workflow',
        entity_id: `landing-search-entity-${index}`,
        title: result,
        subtitle: index === 0 ? 'Parliamentary Group' : 'Budget Committee',
        summary: t('pages.home.publicLanding.searchPreview.resultMeta'),
        search_text: `${result} ${t('pages.home.publicLanding.searchPreview.resultMeta')}`,
        visibility: 'public',
        owner_user_id: null,
        group_id: 'landing-group',
        image_url: null,
        location_latitude: null,
        location_longitude: null,
        location_label: null,
        location_source: null,
        location_kind: null,
        location_place_id: null,
        location_boundary_source: null,
        location_geometry: null,
        location_bounds: null,
        card_payload: {
          type: 'workflow',
          tags: ['climate', 'budget', 'committee'],
        },
        created_at: Date.now() - index * 1000 * 60 * 60,
        updated_at: Date.now() - index * 1000 * 60 * 15,
        engagement_score: 32 - index,
        trending_score: 18 - index,
        topics: [{ topic: 'climate' }, { topic: index === 0 ? 'amendments' : 'events' }],
        group: { id: 'landing-group', name: 'Parliamentary Group' },
      })) as SearchDocument[],
    [t, tArray]
  );

  return (
    <LandingSearchPreviewView
      documents={documents}
      filters={filters}
      onQueryChange={setQuery}
      placeholder={t('features.search.placeholder', { defaultValue: 'Search...' })}
      query={query}
      typingCycle={typingCycle}
      typingTargetLength={searchPreviewQuery.length}
    />
  );
}

function LandingSearchPreviewView({
  documents,
  filters,
  onQueryChange,
  placeholder,
  query,
  typingCycle,
  typingTargetLength,
}: {
  documents: SearchDocument[];
  filters: FilterOption[];
  onQueryChange: (query: string) => void;
  placeholder: string;
  query: string;
  typingCycle: number;
  typingTargetLength: number;
}) {
  const resultBaseDelayMs = 520 + typingTargetLength * 54 + 260;
  const caretOffset = `${Math.min(query.length, 28)}ch`;

  return (
    <div className="landing-search-preview bg-card rounded-lg border p-5 shadow-sm">
      <div className="landing-search-field relative overflow-hidden rounded-md">
        <EntitySearchBar
          searchQuery={query}
          onSearchQueryChange={onQueryChange}
          placeholder={placeholder}
          filterOptions={filters}
          onFilterToggle={() => undefined}
        />
        <span
          className="landing-search-typing-caret pointer-events-none absolute top-3 left-9 h-5 w-px"
          style={{ transform: `translateX(${caretOffset})` }}
        />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {documents.map((document, index) => (
          <div
            key={`${typingCycle}-${document.id}`}
            className="landing-search-result-card min-h-[14rem]"
            style={{ animationDelay: `${resultBaseDelayMs + index * 140}ms` }}
          >
            <SearchResultCard document={document} />
          </div>
        ))}
      </div>
    </div>
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
