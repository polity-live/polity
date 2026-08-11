import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlTextarea,
  FormControlLabel,
  TypeSelector,
} from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/features/shared/ui/ui/carousel';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { PageWrapper } from '@/layout/page-wrapper';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type { CreateAgendaItemFormController } from '../hooks/useCreateAgendaItemFormController';

interface CreateAgendaItemFormViewProps {
  controller: CreateAgendaItemFormController;
}

export function CreateAgendaItemFormView({ controller }: CreateAgendaItemFormViewProps) {
  const {
    formData,
    setFormData,
    isSubmitting,
    carouselApi,
    setCarouselApi,
    currentStep,
    userEvents,
    userAmendments,
    userRoles,
    handleSubmit,
  } = controller;

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
              <CarouselItem>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <FormControlLabel htmlFor="agenda-event">
                      {translateText('generated.inline.0026_event_ad8919ac')}
                    </FormControlLabel>
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
                    <FormControlLabel htmlFor="agenda-title">
                      {translateText('generated.inline.0028_title_768e0c1c')}
                    </FormControlLabel>
                    <FormControlInput
                      id="agenda-title"
                      placeholder={translateText(
                        'generated.inline.0029_enter_agenda_item_title_2e1f5120'
                      )}
                      value={formData.title}
                      onChange={event => setFormData({ ...formData, title: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <FormControlLabel htmlFor="agenda-description">
                      {translateText('generated.inline.0030_description_55f8ebc8')}
                    </FormControlLabel>
                    <FormControlTextarea
                      id="agenda-description"
                      placeholder={translateText(
                        'generated.inline.0031_describe_this_agenda_item_optional_7065a335'
                      )}
                      value={formData.description}
                      onChange={event =>
                        setFormData({ ...formData, description: event.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </CarouselItem>

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
                      <FormControlLabel htmlFor="agenda-order">
                        {translateText('generated.inline.0032_order_1d75774c')}
                      </FormControlLabel>
                      <FormControlInput
                        id="agenda-order"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.order}
                        onChange={event =>
                          setFormData({
                            ...formData,
                            order: parseInt(event.target.value) || 1,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <FormControlLabel htmlFor="agenda-duration">
                        {translateText('generated.inline.0033_duration_minutes_10c3d1ca')}
                      </FormControlLabel>
                      <FormControlInput
                        id="agenda-duration"
                        type="number"
                        min="1"
                        placeholder={translateText('generated.inline.0034_optional_0c6c4102')}
                        value={formData.duration}
                        onChange={event =>
                          setFormData({ ...formData, duration: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CarouselItem>

              <CarouselItem>
                <div className="space-y-4 p-4">
                  {formData.type === 'vote' && (
                    <div className="space-y-2">
                      <FormControlLabel htmlFor="agenda-amendment">
                        {translateText('generated.inline.0035_amendment_optional_c6a38580')}
                      </FormControlLabel>
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
                      <FormControlLabel htmlFor="agenda-role">
                        {translateText('generated.inline.0037_elective_role_optional_5a97b6c3')}
                      </FormControlLabel>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          userRoles,
                          'role',
                          role => role.title || translateText('features.events.agenda.role'),
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

              <CarouselItem>
                <div className="p-4">
                  <Card surface="indigoGradient" className="overflow-hidden">
                    <CardHeader>
                      <div className="mb-2 flex items-center justify-between">
                        <BadgeControl variant="default" size="xs">
                          {translateText('generated.inline.0040_agenda_item_0a13737b')}
                        </BadgeControl>
                        <BadgeControl variant="secondary" size="xs">
                          {formData.type}
                        </BadgeControl>
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
                          {userEvents.find((e: any) => e.id === formData.eventId)?.title ||
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
                            {userAmendments.find((a: any) => a.id === formData.amendmentId)?.title}
                          </span>
                        </div>
                      )}
                      {formData.roleId && (
                        <div className="flex items-center gap-2 text-sm">
                          <strong>{translateText('generated.inline.0045_role_61e4c27b')}</strong>
                          <span className="text-muted-foreground">
                            {userRoles.find((role: any) => role.id === formData.roleId)?.title}
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
            {[0, 1, 2, 3].map((index: any) => (
              <Button
                data-action-id="agendas.create.step.select"
                data-action-kind="selection"
                key={index}
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => carouselApi?.scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full p-0 transition-colors',
                  currentStep === index ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                aria-label={translateText('common.accessibility.goToStep', {
                  step: index + 1,
                })}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            data-action-id="agendas.create.step.previous"
            data-action-kind="selection"
            type="button"
            variant="outline"
            onClick={() => carouselApi?.scrollPrev()}
            disabled={currentStep === 0}
          >
            {translateText('generated.inline.0046_previous_50f94286')}
          </Button>
          {currentStep < 3 ? (
            <Button
              data-action-id="agendas.create.step.next"
              data-action-kind="selection"
              type="button"
              onClick={() => carouselApi?.scrollNext()}
              disabled={currentStep === 0 && !formData.title}
            >
              {translateText('generated.inline.0047_next_bc981983')}
            </Button>
          ) : (
            <Button
              data-action-id="agendas.create.submit"
              data-action-kind="async-action"
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
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
