'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Calendar,
  CheckCircle2,
  FileText,
  GitPullRequest,
  MapPinned,
  MessageSquare,
  Network,
  Search,
  Sparkles,
  Users,
  Vote,
  Workflow,
  type LucideIcon,
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
import { PlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
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
import { useLandingAmendmentPreviewData } from '@/features/public-landing/hooks/useLandingAmendmentPreviewData';
import {
  LANDING_AGENDA_ITEM_ID,
  LANDING_AMENDMENT_REVIEWER_ID,
  LANDING_AMENDMENT_USER_ID,
  type LandingAmendmentPreviewData,
} from '@/features/public-landing/logic/landingAmendmentPreview';
import {
  landingActivityTimelineItems,
  landingActivityTimelineSections,
} from '@/features/public-landing/logic/landingActivityPreview';

const featureCards = [
  { key: 'groups', icon: Users },
  { key: 'events', icon: Calendar },
  { key: 'amendments', icon: FileText },
  { key: 'agendas', icon: Vote },
  { key: 'search', icon: Search },
  { key: 'messages', icon: MessageSquare },
] as const;

const solutionKeys = ['humans', 'parties', 'ngos', 'corporations', 'government'] as const;
const imprintSectionKeys = ['overview', 'operator', 'responsibility', 'legalNotice'] as const;
const landingPreviewUserId = 'landing-preview-user';
type LandingAssistantChatPreview = Parameters<typeof AssistantMessageInput>[0]['assistantChat'];

export function PublicLandingPage() {
  const { t, tArray } = useTranslation();

  return (
    <div className="bg-background text-foreground min-h-screen">
      <section id="home" className="scroll-mt-24 border-b">
        <div className="mx-auto flex max-w-7xl flex-col justify-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[62svh] lg:px-8">
          <div className="max-w-4xl space-y-6">
            <div className="bg-background inline-flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-950 ring-1 ring-zinc-950/10">
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
            </div>

            <div className="space-y-4">
              <p className="text-brand text-sm font-semibold uppercase">
                {t('pages.home.publicLanding.hero.eyebrow')}
              </p>
              <h1 className="max-w-4xl text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl">
                {t('pages.home.publicLanding.hero.title')}
              </h1>
              <p className="text-muted-foreground max-w-3xl text-lg leading-8">
                {t('pages.home.publicLanding.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">{t('pages.home.publicLanding.hero.primaryCta')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">{t('pages.home.publicLanding.hero.secondaryCta')}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-muted/20 scroll-mt-24 border-b">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={t('pages.home.publicLanding.sections.features.eyebrow')}
            title={t('pages.home.publicLanding.sections.features.title')}
            description={t('pages.home.publicLanding.sections.features.description')}
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ key, icon: Icon }) => (
              <Card key={key} className="h-full">
                <CardHeader className="space-y-3 p-5">
                  <div className="bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t(`pages.features.features.${key}.title`)}
                    </CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {t(`pages.features.features.${key}.description`)}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
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
        <LandingAmendmentSectionContent />
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
        eyebrow={t('pages.home.publicLanding.sections.social.eyebrow')}
        title={t('pages.home.publicLanding.sections.social.title')}
        description={t('pages.home.publicLanding.sections.social.description')}
      >
        <LandingSocialAiPreview />
      </StorySection>

      <StorySection
        eyebrow={t('pages.home.publicLanding.sections.timeline.eyebrow')}
        title={t('pages.home.publicLanding.sections.timeline.title')}
        description={t('pages.home.publicLanding.sections.timeline.description')}
      >
        <LandingActivityStripPreview />
      </StorySection>

      <StorySection
        muted
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
                  <CardDescription className="leading-6">
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
    <section className={cn('border-b', muted ? 'bg-muted/20' : 'bg-background')}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-8">{children}</div>
      </div>
    </section>
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

function ProductStoryPoint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="bg-card flex gap-3 rounded-lg border p-4 shadow-sm">
      <div className="bg-brand/10 text-brand flex h-9 w-9 flex-none items-center justify-center rounded-md">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-muted-foreground text-sm leading-6">{text}</p>
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
    <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t('pages.home.publicLanding.network.title')}</p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.network.description')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            {t('pages.home.publicLanding.network.badge')}
          </BadgeControl>
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
              ? '#ccfbf1'
              : String(
                  (node.style as { background?: string } | undefined)?.background ?? '#e5e7eb'
                ),
          nodeStrokeColor: node => (node.data?.kind === 'event' ? '#0f766e' : '#334155'),
          maskColor: 'hsl(var(--background) / 0.62)',
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
                swatchClassName: 'h-4 w-4 rounded border-2 border-teal-700 bg-teal-100',
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
    <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
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
            <BadgeControl variant="secondary" className="font-mono text-[11px]">
              {LANDING_AGENDA_ITEM_ID}
            </BadgeControl>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="before:bg-border relative space-y-4 pl-6 before:absolute before:top-3 before:bottom-3 before:left-2 before:w-px">
          {agendaTimelineItems.map((item, index) => (
            <div key={item.id} className="relative">
              <span className="border-background bg-brand absolute top-5 -left-[22px] h-3 w-3 rounded-full border-2 shadow-sm" />
              <AgendaItemTimelineCard
                agendaItem={item}
                className={cn(index === 0 && 'ring-brand/30 ring-2')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LandingAmendmentSectionContent() {
  const { tArray } = useTranslation();
  const previewData = useLandingAmendmentPreviewData();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-4">
          {tArray('pages.home.publicLanding.sections.amendments.points').map((point, index) => (
            <ProductStoryPoint
              key={point}
              icon={index === 0 ? FileText : index === 1 ? GitPullRequest : Vote}
              text={point}
            />
          ))}
        </div>
        <LandingAmendmentEditorPreview previewData={previewData} />
      </div>
    </div>
  );
}

export function LandingAmendmentEditorPreview({
  previewData,
}: {
  previewData: LandingAmendmentPreviewData;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-card h-full overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.amendmentWorkspace.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.amendmentWorkspace.description')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            {t('pages.home.publicLanding.amendmentWorkspace.badge')}
          </BadgeControl>
        </div>
      </div>
      <div className="space-y-4 p-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {t('pages.home.publicLanding.amendmentText.title')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.amendmentText.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeControl variant="secondary">
            {t('pages.home.publicLanding.amendmentText.status')}
          </BadgeControl>
          <BadgeControl variant="outline">#climate</BadgeControl>
          <BadgeControl variant="outline">#budget</BadgeControl>
        </div>
        <PlateEditor
          key={t('pages.home.publicLanding.amendmentText.documentTitle')}
          initialValue={previewData.documentValue}
          readOnly
          showFixedToolbar={false}
          documentId="landing-amendment-preview"
          documentTitle={t('pages.home.publicLanding.amendmentText.documentTitle')}
          currentMode="vote_event"
          currentUser={{
            id: LANDING_AMENDMENT_REVIEWER_ID,
            name: 'Review delegate',
          }}
          users={{
            [LANDING_AMENDMENT_USER_ID]: {
              id: LANDING_AMENDMENT_USER_ID,
              name: 'Policy lead',
              avatarUrl: '',
            },
            [LANDING_AMENDMENT_REVIEWER_ID]: {
              id: LANDING_AMENDMENT_REVIEWER_ID,
              name: 'Review delegate',
              avatarUrl: '',
            },
          }}
          discussions={previewData.discussions}
          editorVariant="demo"
          containerVariant="demo"
          containerClassName="max-h-[22rem] overflow-y-auto rounded-md border bg-background"
          editorClassName="min-h-[16rem] px-5 py-4"
        />
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
    <div className="bg-card grid gap-5 rounded-lg border p-5 shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
      <Card className="h-full overflow-hidden">
        <CardHeader className="border-b p-4">
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

      <Card className="h-full overflow-hidden">
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
            <Sparkles className="text-brand h-4 w-4" />
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
    <div className="bg-card space-y-4 rounded-lg border p-5 shadow-sm">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <BadgeControl variant="outline" className="rounded-md">
          <MapPinned className="mr-1.5 h-3.5 w-3.5" />
          {t('features.timeline.around.mappedCount', {
            count: landingActivityTimelineItems.length,
            defaultValue: '{{count}} mapped',
          })}
        </BadgeControl>
        <BadgeControl variant="outline" className="rounded-md">
          {t('pages.home.publicLanding.timeline.badge')}
        </BadgeControl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
        <div className="[&_.leaflet-container]:!h-80">
          <CivicTimelineMap
            items={landingActivityTimelineItems}
            activeItemId={activeItemId}
            onActiveItemChange={setActiveItemId}
            onItemSelect={item => setActiveItemId(item.id)}
          />
        </div>
        <CivicTimelineRail
          sections={landingActivityTimelineSections}
          activeItemId={activeItemId}
          onActiveItemChange={setActiveItemId}
          onItemSelect={item => setActiveItemId(item.id)}
        />
      </div>
    </div>
  );
}

export function LandingSearchPreview() {
  const { t, tArray } = useTranslation();
  const [query, setQuery] = useState(t('pages.home.publicLanding.searchPreview.query'));
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
    <div className="bg-card rounded-lg border p-5 shadow-sm">
      <EntitySearchBar
        searchQuery={query}
        onSearchQueryChange={setQuery}
        placeholder={t('pages.home.publicLanding.searchPreview.query')}
        filterOptions={filters}
        onFilterToggle={() => undefined}
      />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {documents.map(document => (
          <div key={document.id} className="min-h-[14rem]">
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
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="bg-background hover:bg-accent rounded-lg border p-5 transition-colors"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground mt-2 text-sm break-words">{value}</p>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{description}</p>
    </a>
  );
}
