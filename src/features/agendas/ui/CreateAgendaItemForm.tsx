'use client';

import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '@/features/shared/ui/ui/carousel';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { TypeSelector } from '@/features/shared/ui/ui/type-selector';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAllEvents, useAllAmendments, useRolesWithGroups } from '@/zero/events/useEventState';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import { PageWrapper } from '@/layout/page-wrapper';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function CreateAgendaItemForm() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  const { user } = useAuth();
  const { createAgendaItem } = useAgendaActions();
  const { createElection } = useElectionActions();
  const { createVote, createVoteChoice } = useVoteActions();

  const eventIdParam = (searchParams as Record<string, string | undefined>).eventId;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'discussion' as 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation',
    order: 1,
    duration: '',
    eventId: eventIdParam || '',
    amendmentId: '', // For vote type
    roleId: '', // For election type
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    carouselApi.on('select', () => {
      setCurrentStep(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  // Query available events for the dropdown
  const { events: userEvents } = useAllEvents();

  // Query available amendments for the dropdown (when type is vote)
  const { amendments: userAmendments } = useAllAmendments();

  // Query available roles for the dropdown (when type is election)
  const { roles: userRoles } = useRolesWithGroups();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (!user?.id) {
        toast.error(
          translateText(
            'generated.inline.0021_you_must_be_logged_in_to_create_an_agenda_ite_959a22b0'
          )
        );
        setIsSubmitting(false);
        return;
      }

      if (!formData.eventId) {
        toast.error(
          translateText(
            'generated.inline.0022_please_select_an_event_for_this_agenda_item_e6169d47'
          )
        );
        setIsSubmitting(false);
        return;
      }

      const agendaItemId = crypto.randomUUID();

      // Create the agenda item
      await createAgendaItem({
        id: agendaItemId,
        title: formData.title,
        description: formData.description || '',
        type: formData.type,
        order_index: formData.order,
        duration: formData.duration ? parseInt(formData.duration) : 0,
        status: 'pending',
        forwarding_status: '',
        scheduled_time: '',
        start_time: 0,
        end_time: 0,
        activated_at: 0,
        completed_at: 0,
        event_id: formData.eventId,
        amendment_id: formData.amendmentId || '',
        majority_type: null,
        time_limit: null,
        voting_phase: null,
      });

      // If creating an election, also create the election entity
      if (formData.type === 'election') {
        const electionId = crypto.randomUUID();
        await createElection({
          id: electionId,
          title: formData.title,
          description: formData.description || null,
          status: 'indicative',
          majority_type: 'relative',
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          max_votes: 1,
          agenda_item_id: agendaItemId,
          role_id: formData.roleId || null,
        });
      }

      // If creating a vote, also create the vote entity with default choices
      if (formData.type === 'vote') {
        const voteId = crypto.randomUUID();
        await createVote({
          id: voteId,
          title: formData.title,
          description: formData.description || null,
          status: 'indicative',
          majority_type: 'relative',
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          agenda_item_id: agendaItemId,
          amendment_id: formData.amendmentId || null,
        });

        // Create default choices: Yes, No, Abstain
        const defaultChoices = ['Yes', 'No', 'Abstain'];
        for (let i = 0; i < defaultChoices.length; i++) {
          await createVoteChoice({
            id: crypto.randomUUID(),
            vote_id: voteId,
            label: defaultChoices[i],
            order_index: i + 1,
          });
        }
      }

      await Promise.resolve(); // mutations already committed above

      toast.success(
        translateText('generated.inline.0023_agenda_item_created_successfully_4eb7ae08')
      );
      navigate({ to: `/event/${formData.eventId}/agenda` });
    } catch (error) {
      console.error('Failed to create agenda item:', error);
      toast.error(
        translateText(
          'generated.inline.0024_failed_to_create_agenda_item_please_try_again_b0524017'
        )
      );
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            {translateText('generated.inline.0025_create_a_new_agenda_item_b0be8c15')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Carousel setApi={setCarouselApi} opts={{ watchDrag: false }}>
            <CarouselContent>
              {/* Step 1: Basic Information */}
              <CarouselItem>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="agenda-event">
                      {translateText('generated.inline.0026_event_ad8919ac')}
                    </Label>
                    <TypeaheadSearch
                      items={toTypeaheadItems(
                        userEvents,
                        'event',
                        e => e.title || 'Event',
                        e =>
                          typeof e.description === 'string'
                            ? e.description.substring(0, 60)
                            : undefined,
                        undefined,
                        e => `/event/${e.id}`
                      )}
                      value={formData.eventId}
                      onChange={(item: TypeaheadItem | null) =>
                        setFormData({ ...formData, eventId: item?.id ?? '' })
                      }
                      placeholder={translateText(
                        'generated.inline.0027_search_for_an_event_2c0dc7bd'
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agenda-title">
                      {translateText('generated.inline.0028_title_768e0c1c')}
                    </Label>
                    <Input
                      id="agenda-title"
                      placeholder={translateText(
                        'generated.inline.0029_enter_agenda_item_title_2e1f5120'
                      )}
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agenda-description">
                      {translateText('generated.inline.0030_description_55f8ebc8')}
                    </Label>
                    <Textarea
                      id="agenda-description"
                      placeholder={translateText(
                        'generated.inline.0031_describe_this_agenda_item_optional_7065a335'
                      )}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </CarouselItem>

              {/* Step 2: Type & Settings */}
              <CarouselItem>
                <div className="space-y-4 p-4">
                  <TooltipProvider>
                    <TypeSelector
                      value={formData.type}
                      onChange={type => setFormData({ ...formData, type })}
                    />
                  </TooltipProvider>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="agenda-order">
                        {translateText('generated.inline.0032_order_1d75774c')}
                      </Label>
                      <Input
                        id="agenda-order"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.order}
                        onChange={e =>
                          setFormData({ ...formData, order: parseInt(e.target.value) || 1 })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agenda-duration">
                        {translateText('generated.inline.0033_duration_minutes_10c3d1ca')}
                      </Label>
                      <Input
                        id="agenda-duration"
                        type="number"
                        min="1"
                        placeholder={translateText('generated.inline.0034_optional_0c6c4102')}
                        value={formData.duration}
                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </CarouselItem>

              {/* Step 3: Additional Links */}
              <CarouselItem>
                <div className="space-y-4 p-4">
                  {formData.type === 'vote' && (
                    <div className="space-y-2">
                      <Label htmlFor="agenda-amendment">
                        {translateText('generated.inline.0035_amendment_optional_c6a38580')}
                      </Label>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          userAmendments,
                          'amendment',
                          a => a.title || 'Amendment',
                          undefined,
                          undefined,
                          a => `/amendment/${a.id}`
                        )}
                        value={formData.amendmentId}
                        onChange={(item: TypeaheadItem | null) =>
                          setFormData({ ...formData, amendmentId: item?.id ?? '' })
                        }
                        placeholder={translateText(
                          'generated.inline.0036_search_for_an_amendment_5231be40'
                        )}
                      />
                    </div>
                  )}
                  {formData.type === 'election' && (
                    <div className="space-y-2">
                      <Label htmlFor="agenda-role">
                        {translateText('generated.inline.0037_elective_role_optional_5a97b6c3')}
                      </Label>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          userRoles,
                          'role',
                          role => role.title || 'Role',
                          role => role.description?.substring(0, 60)
                        )}
                        value={formData.roleId}
                        onChange={(item: TypeaheadItem | null) =>
                          setFormData({ ...formData, roleId: item?.id ?? '' })
                        }
                        placeholder={translateText(
                          'generated.inline.0038_search_for_an_elective_role_f4433fda'
                        )}
                      />
                    </div>
                  )}
                  {formData.type !== 'vote' && formData.type !== 'election' && (
                    <div className="text-muted-foreground py-8 text-center">
                      {translateText(
                        'generated.inline.0039_no_additional_configuration_needed_for_this_a_9a7e9135'
                      )}
                    </div>
                  )}
                </div>
              </CarouselItem>

              {/* Step 4: Review */}
              <CarouselItem>
                <div className="p-4">
                  <Card className="overflow-hidden border-2 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/50">
                    <CardHeader>
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="default" className="text-xs">
                          {translateText('generated.inline.0040_agenda_item_0a13737b')}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {formData.type}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">
                        {formData.title ||
                          translateText('generated.inline.0011_untitled_agenda_item_fcb0e488')}
                      </CardTitle>
                      {formData.description && (
                        <CardDescription>{formData.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <strong>{translateText('generated.inline.0041_event_e1d18730')}</strong>
                        <span className="text-muted-foreground">
                          {userEvents.find(e => e.id === formData.eventId)?.title ||
                            translateText('generated.inline.0012_not_selected_183079f3')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <strong>{translateText('generated.inline.0042_order_3c124cca')}</strong>
                        <span className="text-muted-foreground">#{formData.order}</span>
                      </div>
                      {formData.duration && (
                        <div className="flex items-center gap-2 text-sm">
                          <strong>
                            {translateText('generated.inline.0043_duration_9693aeaa')}
                          </strong>
                          <span className="text-muted-foreground">
                            {formData.duration}
                            {translateText('generated.inline.0006_minutes_be2e2bb6')}
                          </span>
                        </div>
                      )}
                      {formData.amendmentId && (
                        <div className="flex items-center gap-2 text-sm">
                          <strong>
                            {translateText('generated.inline.0044_amendment_e0b72231')}
                          </strong>
                          <span className="text-muted-foreground">
                            {userAmendments.find(a => a.id === formData.amendmentId)?.title}
                          </span>
                        </div>
                      )}
                      {formData.roleId && (
                        <div className="flex items-center gap-2 text-sm">
                          <strong>{translateText('generated.inline.0045_role_61e4c27b')}</strong>
                          <span className="text-muted-foreground">
                            {userRoles.find(role => role.id === formData.roleId)?.title}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2, 3].map(index => (
              <button
                key={index}
                type="button"
                onClick={() => carouselApi?.scrollTo(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  currentStep === index ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => carouselApi?.scrollPrev()}
            disabled={currentStep === 0}
          >
            {translateText('generated.inline.0046_previous_50f94286')}
          </Button>
          {currentStep < 3 ? (
            <Button
              type="button"
              onClick={() => carouselApi?.scrollNext()}
              disabled={currentStep === 0 && !formData.title}
            >
              {translateText('generated.inline.0047_next_bc981983')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? translateText('generated.inline.0013_creating_28ea7667')
                : translateText('generated.inline.0014_create_agenda_item_8fa636c7')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </PageWrapper>
  );
}
