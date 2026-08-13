/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => (
    <a href={`/user/${params?.id ?? ''}`}>{children}</a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      values?.count === undefined ? key : `${key}:${values.count}`,
  }),
}));
vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselNext: () => null,
  CarouselPrevious: () => null,
}));

import { AgendaSpeakerListSection } from '@/features/agendas/ui/AgendaSpeakerListSection';

const speaker = (id: string, order: number, userId: string, completed = false) => ({
  id,
  order,
  time: 3,
  completed,
  user: { id: userId, name: userId },
});

afterEach(cleanup);

describe('speaker queue component flow', () => {
  it('lets an authenticated participant register a speaking contribution', () => {
    const onAddToSpeakerList = vi.fn();
    renderComponentFlow(
      <AgendaSpeakerListSection
        speakers={[]}
        isUserInSpeakerList={false}
        canManageSpeakers={false}
        isAddingSpeaker={false}
        userId="voter-a"
        onAddToSpeakerList={onAddToSpeakerList}
      />
    );

    const join = document.querySelector('[data-action-id="agendas.speakers.membership.join"]')!;
    fireEvent.click(join);

    expect(onAddToSpeakerList).toHaveBeenCalledOnce();
    expect(screen.getByText('features.events.agenda.speakerListEmpty')).toBeTruthy();
  });

  it('updates the visible queue order and allows the manager to finish the current turn', () => {
    const onMarkCompleted = vi.fn();
    const { rerender } = renderComponentFlow(
      <AgendaSpeakerListSection
        speakers={[speaker('late', 2, 'voter-b'), speaker('current', 1, 'voter-a')]}
        isUserInSpeakerList
        canManageSpeakers
        isAddingSpeaker={false}
        userId="voter-a"
        onMarkCompleted={onMarkCompleted}
      />
    );

    const profilesBefore = screen.getAllByRole('link').map(node => node.getAttribute('href'));
    expect(profilesBefore).toEqual(['/user/voter-a', '/user/voter-b']);
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.speakers.current.complete"]')!
    );
    expect(onMarkCompleted).toHaveBeenCalledWith('current');

    rerender(
      <AgendaSpeakerListSection
        speakers={[speaker('late', 1, 'voter-b'), speaker('current', 2, 'voter-a', true)]}
        isUserInSpeakerList
        canManageSpeakers
        isAddingSpeaker={false}
        userId="voter-a"
        onMarkCompleted={onMarkCompleted}
      />
    );
    expect(screen.getAllByRole('link').map(node => node.getAttribute('href'))).toEqual([
      '/user/voter-b',
      '/user/voter-a',
    ]);
  });

  it('does not expose management or leave actions for another users contribution', () => {
    const onMarkCompleted = vi.fn();
    renderComponentFlow(
      <AgendaSpeakerListSection
        speakers={[speaker('foreign', 1, 'voter-b')]}
        isUserInSpeakerList={false}
        canManageSpeakers={false}
        isAddingSpeaker={false}
        userId="voter-a"
        onMarkCompleted={onMarkCompleted}
      />
    );

    expect(screen.getByRole('link', { name: /voter-b/ })).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="agendas.speakers.current.complete"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-action-id="agendas.speakers.membership.leave"]')
    ).toBeNull();
    expect(onMarkCompleted).not.toHaveBeenCalled();
  });
});
