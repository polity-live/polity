'use client';

import { Link } from '@tanstack/react-router';
import { CircleHelp, Mail, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/features/shared/ui/ui/carousel';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import {
  getEntityToneClasses,
  getMotionPreset,
  getRoleToneClasses,
  type PrimaryEntityTone,
} from '@/features/shared/theme';
import type {
  WikiIncumbentCard,
  WikiIncumbentCarouselSection,
  WikiIncumbentPersonCard,
  WikiIncumbentVacancyCard,
} from '@/features/shared/logic/wikiIncumbentSections';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface WikiIncumbentPanelProps {
  title: string;
  description: string;
  sections: readonly WikiIncumbentCarouselSection[];
  icon?: LucideIcon;
  entityType?: PrimaryEntityTone;
  className?: string;
}

export function WikiIncumbentPanel({
  title,
  description,
  sections,
  entityType = 'group',
  className,
}: WikiIncumbentPanelProps) {
  const visibleSections = sections.filter(section => section.cards.length > 0);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <section data-slot="wiki-incumbent-panel" className={cn('mb-6 space-y-5', className)}>
      <Card data-slot="wiki-incumbent-header-card">
        <CardHeader className="p-4 md:p-5">
          <CardTitle size="lg" className="leading-tight">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {visibleSections.map(section => (
          <section key={section.id} data-slot="wiki-incumbent-section" className="space-y-4">
            <Card data-slot="wiki-incumbent-section-header-card">
              <CardHeader className="p-4 md:p-5">
                <CardTitle size="lg" className="leading-tight">
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>

            <Carousel
              data-slot="wiki-incumbent-carousel"
              opts={{
                align: 'start',
                dragFree: true,
              }}
              className="w-full px-10"
            >
              <CarouselContent className="-ml-3 md:-ml-4">
                {section.cards.map(card => (
                  <CarouselItem
                    key={card.id}
                    className="basis-[86%] pl-3 sm:basis-[68%] md:basis-[50%] md:pl-4 lg:basis-[38%] xl:basis-[30%]"
                  >
                    <WikiIncumbentCardTile card={card} entityType={entityType} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0" />
              <CarouselNext className="right-0" />
            </Carousel>
          </section>
        ))}
      </div>
    </section>
  );
}

interface WikiIncumbentCardTileProps {
  card: WikiIncumbentCard;
  entityType: PrimaryEntityTone;
}

function WikiIncumbentCardTile({ card, entityType }: WikiIncumbentCardTileProps) {
  if (card.kind === 'vacancy') {
    return <VacancyCard card={card} />;
  }

  return <PersonCard card={card} entityType={entityType} />;
}

function PersonCard({
  card,
  entityType,
}: {
  card: WikiIncumbentPersonCard;
  entityType: PrimaryEntityTone;
}) {
  const entityTone = getEntityToneClasses(entityType);
  const roleTone = getRoleToneClasses();

  return (
    <Card
      data-slot="wiki-incumbent-card"
      className={cn('relative h-full overflow-hidden shadow-sm', getMotionPreset('hoverLift'))}
    >
      <Link
        to="/user/$id"
        params={{ id: card.userId }}
        className={cn(
          'absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none',
          entityTone.ring
        )}
        aria-label={`Open profile for ${card.name}`}
      >
        <span className="sr-only">
          {translateText('generated.inline.1152_open_profile_for_68af0481')}
          {card.name}
        </span>
      </Link>
      <div className="pointer-events-none relative z-20 flex h-full flex-col gap-6 p-5">
        <div className="flex justify-end">
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="bg-background/80 pointer-events-auto h-9 w-9 rounded-full shadow-sm backdrop-blur-sm"
          >
            <Link
              to="/messages"
              search={{ userId: card.userId, name: card.name }}
              aria-label={`Message ${card.name}`}
            >
              <Mail className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Avatar className="ring-background/90 h-24 w-24 shadow-lg ring-4">
            <AvatarImage src={card.avatar ?? undefined} alt={card.name} />
            <AvatarFallback className="bg-background/90 text-foreground text-xl font-semibold">
              {getInitials(card.name)}
            </AvatarFallback>
          </Avatar>
          <div className="mt-4 space-y-1">
            <p className="text-foreground text-xl leading-tight font-semibold">{card.name}</p>
            {card.handle && <p className="text-foreground/70 text-sm">@{card.handle}</p>}
          </div>
        </div>

        <div
          className={cn(
            'flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-center shadow-sm backdrop-blur-sm',
            roleTone.badge
          )}
        >
          <span className="text-sm font-medium">{card.roleTitle}</span>
          <RoleDescriptionButton title={card.roleTitle} description={card.roleDescription} />
        </div>
      </div>
    </Card>
  );
}

function VacancyCard({ card }: { card: WikiIncumbentVacancyCard }) {
  const roleTone = getRoleToneClasses();

  return (
    <Card
      data-slot="wiki-incumbent-card"
      className={cn('relative h-full overflow-hidden shadow-sm', getMotionPreset('colors'))}
    >
      <div className="relative flex h-full flex-col gap-6 p-5">
        <div className="flex justify-end">
          <RoleDescriptionButton title={card.roleTitle} description={card.roleDescription} />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="border-foreground/15 bg-background/75 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed shadow-sm">
            <User className="text-muted-foreground h-10 w-10" />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-foreground text-xl font-semibold">
              {translateText('generated.inline.1070_vacant_1966f967')}
            </p>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.1153_no_active_incumbent_assigned_yet_dd93531b')}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center justify-center gap-2 rounded-full border border-dashed px-4 py-2 text-center shadow-sm backdrop-blur-sm',
            roleTone.badge
          )}
        >
          <span className="text-sm font-medium">{card.roleTitle}</span>
          <RoleDescriptionButton title={card.roleTitle} description={card.roleDescription} />
        </div>
      </div>
    </Card>
  );
}

function RoleDescriptionButton({
  title,
  description,
}: {
  title: string;
  description: string | null;
}) {
  if (!description) {
    return null;
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground pointer-events-auto h-7 w-7 rounded-full"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="sr-only">
                {translateText('generated.inline.1154_show_role_description_for_a227cdaf')}
                {title}
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{description}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 space-y-2" align="end">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'U';
}
