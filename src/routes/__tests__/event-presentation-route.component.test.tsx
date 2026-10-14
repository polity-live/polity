// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  params: { id: 'event' },
  search: { mode: 'agenda', regie: true },
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: any) => ({
    options,
    useParams: () => mock.params,
    useSearch: () => mock.search,
  }),
}));
vi.mock('@/features/agendas/ui/EventPresentation', () => ({
  EventPresentation: (props: any) => <div data-testid="screen">{JSON.stringify(props)}</div>,
}));
import { Route } from '../_authed/event/$id/presentation';
it('opens event presentation deep links and validates explicit show and controller modes', () => {
  const options = Route.options as any;
  const Component = options.component;
  render(<Component />);
  expect(screen.getByTestId('screen').textContent).toBe(
    JSON.stringify({ eventId: 'event', initialMode: 'agenda', regie: true })
  );
  expect(options.validateSearch.parse({ regie: 'false', mode: 'studio' })).toEqual({
    regie: false,
    mode: 'studio',
  });
  expect(options.validateSearch.safeParse({ mode: 'invalid' }).success).toBe(false);
});
