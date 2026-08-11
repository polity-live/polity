/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccreditationSectionView } from '../AccreditationSectionView';
import { CreateAgendaItemFormView } from '../CreateAgendaItemFormView';
import { TransferAgendaItemDialogView } from '../TransferAgendaItemDialogView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/features/vote-cast/ui/VotePasswordInput', () => ({
  VotePasswordInput: () => <div data-testid="password-input" />,
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: ({
    onChange,
    items,
    placeholder,
  }: {
    onChange: (item: unknown) => void;
    items: unknown[];
    placeholder: string;
  }) => (
    <div data-testid={`typeahead-${placeholder}`}>
      <button type="button" onClick={() => onChange(items[0])}>
        Select first item
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Clear item
      </button>
    </div>
  ),
}));

vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function action(container: HTMLElement, id: string) {
  const element = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing action ${id}`);
  return element;
}

function accreditationController(overrides: Record<string, unknown> = {}) {
  return {
    accreditationsByAgendaItem: [],
    isAccredited: false,
    accreditationStatus: null,
    accreditedCount: 0,
    isLoading: false,
    canManageAccreditations: false,
    showPasswordInput: false,
    isConfirming: false,
    passwordError: null,
    noVotingPasswordSettingsHref: '/settings',
    handleConfirmClick: vi.fn(),
    handlePasswordSubmit: vi.fn(),
    approveAccreditation: vi.fn(),
    rejectAccreditation: vi.fn(),
    revokeAccreditation: vi.fn(),
    ...overrides,
  } as never;
}

describe('agenda workflow action contracts', () => {
  it('confirms attendance and manages accreditation requests through stable async actions', () => {
    const handleConfirmClick = vi.fn();
    const approveAccreditation = vi.fn();
    const rejectAccreditation = vi.fn();
    const revokeAccreditation = vi.fn();
    const { container, rerender } = render(
      <AccreditationSectionView controller={accreditationController({ handleConfirmClick })} />
    );

    fireEvent.click(action(container, 'agendas.accreditation.attendance.confirm'));
    expect(handleConfirmClick).toHaveBeenCalledTimes(1);

    rerender(
      <AccreditationSectionView controller={accreditationController({ showPasswordInput: true })} />
    );
    expect(container.querySelector('[data-testid="password-input"]')).toBeTruthy();

    rerender(
      <AccreditationSectionView
        controller={accreditationController({
          isAccredited: true,
          canManageAccreditations: true,
          accreditationsByAgendaItem: [
            { id: 'pending-1', user_id: 'ada', status: 'pending' },
            { id: 'approved-1', user_id: 'bert', status: 'approved' },
          ],
          approveAccreditation,
          rejectAccreditation,
          revokeAccreditation,
        })}
      />
    );
    fireEvent.click(action(container, 'agendas.accreditation.request.approve'));
    fireEvent.click(action(container, 'agendas.accreditation.request.reject'));
    fireEvent.click(action(container, 'agendas.accreditation.approval.revoke'));
    expect(approveAccreditation).toHaveBeenCalledWith({ accreditation_id: 'pending-1' });
    expect(rejectAccreditation).toHaveBeenCalledWith({ accreditation_id: 'pending-1' });
    expect(revokeAccreditation).toHaveBeenCalledWith({ accreditation_id: 'approved-1' });
  });

  it('opens, cancels, and confirms agenda transfer with isolated controller effects', () => {
    const setOpen = vi.fn();
    const handleConfirmTransfer = vi.fn();
    const baseController = {
      open: false,
      setOpen,
      selectedEventId: '',
      setSelectedEventId: vi.fn(),
      selectedEvent: null,
      eventsWithPermission: [],
      participationsLoading: false,
      transferLoading: false,
      handleConfirmTransfer,
    };
    const { container, rerender } = render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Assembly A"
        controller={baseController as never}
      />
    );
    fireEvent.click(action(container, 'agendas.transfer.dialog.open'));
    expect(setOpen).toHaveBeenCalledWith(true);

    rerender(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Assembly A"
        controller={{ ...baseController, open: true, selectedEventId: 'event-2' } as never}
      />
    );
    fireEvent.click(action(document.body, 'agendas.transfer.cancel'));
    fireEvent.click(action(document.body, 'agendas.transfer.confirm'));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(handleConfirmTransfer).toHaveBeenCalledTimes(1);
  });

  it('navigates the create carousel and submits through stable form actions', () => {
    const carouselApi = {
      scrollTo: vi.fn(),
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
    };
    const handleSubmit = vi.fn();
    const baseController = {
      formData: {
        eventId: '',
        title: 'Budget',
        description: '',
        type: 'discussion',
        duration: 10,
        amendmentId: '',
        electionId: '',
      },
      setFormData: vi.fn(),
      isSubmitting: false,
      carouselApi,
      setCarouselApi: vi.fn(),
      currentStep: 1,
      userEvents: [],
      userAmendments: [],
      userRoles: [],
      handleSubmit,
    };
    const { container, rerender } = render(
      <CreateAgendaItemFormView controller={baseController as never} />
    );

    fireEvent.click(action(container, 'agendas.create.step.select'));
    fireEvent.click(action(container, 'agendas.create.step.previous'));
    fireEvent.click(action(container, 'agendas.create.step.next'));
    expect(carouselApi.scrollTo).toHaveBeenCalledWith(0);
    expect(carouselApi.scrollPrev).toHaveBeenCalledTimes(1);
    expect(carouselApi.scrollNext).toHaveBeenCalledTimes(1);

    rerender(
      <CreateAgendaItemFormView controller={{ ...baseController, currentStep: 3 } as never} />
    );
    fireEvent.click(action(container, 'agendas.create.submit'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates every create field and handles populated vote and election choices', () => {
    const setFormData = vi.fn();
    const richController = {
      formData: {
        eventId: 'event-1',
        title: 'Budget',
        description: 'Annual budget',
        type: 'vote',
        order: 2,
        duration: '15',
        amendmentId: 'amendment-1',
        roleId: '',
      },
      setFormData,
      isSubmitting: false,
      carouselApi: null,
      setCarouselApi: vi.fn(),
      currentStep: 0,
      userEvents: [
        { id: 'event-1', title: 'Assembly', description: 'A'.repeat(70) },
        { id: 'event-2', title: '', description: null },
      ],
      userAmendments: [
        { id: 'amendment-1', title: 'Budget amendment' },
        { id: 'amendment-2', title: '' },
      ],
      userRoles: [],
      handleSubmit: vi.fn(),
    };
    const { container, rerender } = render(
      <CreateAgendaItemFormView controller={richController as never} />
    );

    const eventPicker = screen.getByTestId(
      'typeahead-generated.inline.0027_search_for_an_event_2c0dc7bd'
    );
    fireEvent.click(eventPicker.querySelectorAll('button')[0]);
    fireEvent.click(eventPicker.querySelectorAll('button')[1]);
    const amendmentPicker = screen.getByTestId(
      'typeahead-generated.inline.0036_search_for_an_amendment_5231be40'
    );
    fireEvent.click(amendmentPicker.querySelectorAll('button')[0]);
    fireEvent.click(amendmentPicker.querySelectorAll('button')[1]);

    fireEvent.change(screen.getByLabelText('generated.inline.0028_title_768e0c1c'), {
      target: { value: 'Updated title' },
    });
    fireEvent.change(screen.getByLabelText('generated.inline.0030_description_55f8ebc8'), {
      target: { value: 'Updated description' },
    });
    const orderInput = screen.getByLabelText('generated.inline.0032_order_1d75774c');
    fireEvent.change(orderInput, { target: { value: '7' } });
    fireEvent.change(orderInput, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('generated.inline.0033_duration_minutes_10c3d1ca'), {
      target: { value: '20' },
    });
    fireEvent.click(container.querySelector('[data-create-option="election"]')!);
    for (const dot of container.querySelectorAll('[data-action-id="agendas.create.step.select"]')) {
      fireEvent.click(dot);
    }
    fireEvent.click(action(container, 'agendas.create.step.previous'));
    fireEvent.click(action(container, 'agendas.create.step.next'));

    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-1' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ eventId: '' }));
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ amendmentId: 'amendment-1' })
    );
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ amendmentId: '' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ order: 7 }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ order: 1 }));

    rerender(
      <CreateAgendaItemFormView
        controller={
          {
            ...richController,
            formData: {
              ...richController.formData,
              type: 'election',
              amendmentId: '',
              roleId: 'role-1',
            },
            userRoles: [
              { id: 'role-1', title: 'Chair', description: 'Leads the assembly' },
              { id: 'role-2', title: '', description: null },
            ],
          } as never
        }
      />
    );
    const rolePicker = screen.getByTestId(
      'typeahead-generated.inline.0038_search_for_an_elective_role_f4433fda'
    );
    fireEvent.click(rolePicker.querySelectorAll('button')[0]);
    fireEvent.click(rolePicker.querySelectorAll('button')[1]);
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ roleId: 'role-1' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ roleId: '' }));
  });

  it('renders empty preview fallbacks and the submitting state', () => {
    const controller = {
      formData: {
        eventId: 'missing-event',
        title: '',
        description: '',
        type: 'discussion',
        order: 1,
        duration: '',
        amendmentId: '',
        roleId: '',
      },
      setFormData: vi.fn(),
      isSubmitting: true,
      carouselApi: null,
      setCarouselApi: vi.fn(),
      currentStep: 3,
      userEvents: [],
      userAmendments: [],
      userRoles: [],
      handleSubmit: vi.fn(),
    };
    const { container } = render(<CreateAgendaItemFormView controller={controller as never} />);

    expect(container.textContent).toContain('generated.inline.0011_untitled_agenda_item_fcb0e488');
    expect(container.textContent).toContain('generated.inline.0012_not_selected_183079f3');
    expect(container.textContent).toContain('generated.inline.0013_creating_28ea7667');
  });
});
