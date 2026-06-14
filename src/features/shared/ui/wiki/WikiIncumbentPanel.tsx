'use client';

import { Link } from '@tanstack/react-router';
import { CircleHelp, Mail, User, UserCheck, type LucideIcon } from 'lucide-react';
import { GRADIENTS } from '@/features/users/state/gradientColors';
import { cn } from '@/features/shared/utils/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/features/shared/ui/ui/carousel';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
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
  className?: string;
}

export function WikiIncumbentPanel({
  title,
  description,
  sections,
  icon: Icon = UserCheck,
  className,
}: WikiIncumbentPanelProps) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <Card className={cn('border-border/60 mb-6 overflow-hidden', className)}>
      <CardHeader className="border-border/60 bg-muted/30 border-b">
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        {sections.map(section => (
          <section key={section.id} className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg leading-tight font-semibold">{section.title}</h3>
              <p className="text-muted-foreground text-sm">{section.description}</p>
            </div>
            <Carousel
              opts={{
                align: 'start',
                dragFree: true,
              }}
              className="w-full px-10"
            >
              <CarouselContent className="-ml-3 md:-ml-4">
                {section.cards.map((card, index) => (
                  <CarouselItem
                    key={card.id}
                    className="basis-[86%] pl-3 sm:basis-[68%] md:basis-[50%] md:pl-4 lg:basis-[38%] xl:basis-[30%]"
                  >
                    <WikiIncumbentCardTile
                      card={card}
                      accentClassName={GRADIENTS[index % GRADIENTS.length]}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0" />
              <CarouselNext className="right-0" />
            </Carousel>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

interface WikiIncumbentCardTileProps {
  card: WikiIncumbentCard;
  accentClassName: string;
}

function WikiIncumbentCardTile({ card, accentClassName }: WikiIncumbentCardTileProps) {
  if (card.kind === 'vacancy') {
    return <VacancyCard card={card} accentClassName={accentClassName} />;
  }

  return <PersonCard card={card} accentClassName={accentClassName} />;
}

function PersonCard({
  card,
  accentClassName,
}: {
  card: WikiIncumbentPersonCard;
  accentClassName: string;
}) {
  return (
    <Card
      className={cn(
        'relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        accentClassName
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-black/5" />
      <Link
        to="/user/$id"
        params={{ id: card.userId }}
        className="focus-visible:ring-primary absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
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

        <div className="bg-background/80 flex items-center justify-center gap-2 rounded-full border border-black/5 px-4 py-2 text-center shadow-sm backdrop-blur-sm">
          <span className="text-foreground/85 text-sm font-medium">{card.roleTitle}</span>
          <RoleDescriptionButton title={card.roleTitle} description={card.roleDescription} />
        </div>
      </div>
    </Card>
  );
}

function VacancyCard({
  card,
  accentClassName,
}: {
  card: WikiIncumbentVacancyCard;
  accentClassName: string;
}) {
  return (
    <Card
      className={cn(
        'relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-black/5 transition-all duration-300',
        accentClassName
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-black/5" />
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

        <div className="bg-background/80 flex items-center justify-center gap-2 rounded-full border border-dashed border-black/10 px-4 py-2 text-center shadow-sm backdrop-blur-sm">
          <span className="text-foreground/85 text-sm font-medium">{card.roleTitle}</span>
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
