/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const carouselMocks = vi.hoisted(() => ({
  api: {
    canScrollPrev: vi.fn(() => true),
    canScrollNext: vi.fn(() => true),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  currentApi: undefined as any,
  ref: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [carouselMocks.ref, carouselMocks.currentApi],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../carousel';

function renderCarousel() {
  return render(
    <Carousel>
      <CarouselContent>
        <CarouselItem>
          <input aria-label="Slide input" />
        </CarouselItem>
      </CarouselContent>
    </Carousel>
  );
}

function renderCarouselWithControls() {
  return render(
    <Carousel>
      <CarouselContent>
        <CarouselItem>Slide</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

beforeEach(() => {
  carouselMocks.currentApi = carouselMocks.api;
  carouselMocks.api.canScrollPrev.mockReturnValue(true);
  carouselMocks.api.canScrollNext.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Carousel keyboard navigation', () => {
  it('scrolls with local arrow keys on the carousel region', async () => {
    renderCarousel();
    await waitFor(() => expect(carouselMocks.api.on).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowRight' });
    expect(carouselMocks.api.scrollNext).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowLeft' });
    expect(carouselMocks.api.scrollPrev).toHaveBeenCalledTimes(1);
  });

  it('does not steal arrow keys from editable slide content', async () => {
    renderCarousel();
    await waitFor(() => expect(carouselMocks.api.on).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByLabelText('Slide input'), { key: 'ArrowRight' });

    expect(carouselMocks.api.scrollNext).not.toHaveBeenCalled();
  });

  it('uses rounded-corner navigation controls instead of circular buttons', async () => {
    renderCarouselWithControls();
    await waitFor(() => expect(carouselMocks.api.on).toHaveBeenCalled());

    const buttons = screen.getAllByRole('button');

    for (const button of buttons) {
      expect(button.className).toContain('rounded-md');
      expect(button.className).not.toContain('rounded-full');
    }
  });

  it('supports vertical layout, explicit props, API publication, and disabled controls', async () => {
    carouselMocks.api.canScrollPrev.mockReturnValue(false);
    carouselMocks.api.canScrollNext.mockReturnValue(false);
    const setApi = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    const view = render(
      <Carousel
        orientation="vertical"
        opts={{ loop: true }}
        plugins={[]}
        setApi={setApi}
        onKeyDown={onKeyDown}
        tabIndex={3}
      >
        <CarouselContent className="content-class">
          <CarouselItem className="item-class">Vertical slide</CarouselItem>
        </CarouselContent>
        <CarouselPrevious variant="ghost" size="sm" />
        <CarouselNext variant="ghost" size="sm" />
      </Carousel>
    );
    await waitFor(() => expect(setApi).toHaveBeenCalledWith(carouselMocks.api));
    const region = screen.getByRole('region');
    expect(region.getAttribute('tabindex')).toBe('3');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(onKeyDown).toHaveBeenCalled();
    expect(carouselMocks.api.scrollNext).not.toHaveBeenCalled();
    expect(screen.getByText('Vertical slide').className).toContain('pt-4');
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.className).toContain('rotate-90');
    }
    view.unmount();
    expect(carouselMocks.api.off).toHaveBeenCalled();
  });

  it('handles a missing carousel API without publishing or scrolling', () => {
    carouselMocks.currentApi = undefined;
    const setApi = vi.fn();
    render(
      <Carousel setApi={setApi}>
        <CarouselContent>
          <CarouselItem>Unavailable</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    );
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(setApi).not.toHaveBeenCalled();
  });

  it('updates control state from selection events and tolerates an empty callback API', async () => {
    renderCarouselWithControls();
    await waitFor(() => expect(carouselMocks.api.on).toHaveBeenCalled());
    const onSelect = carouselMocks.api.on.mock.calls.find(call => call[0] === 'select')?.[1];
    expect(onSelect).toBeTypeOf('function');
    onSelect(undefined);
    carouselMocks.api.canScrollPrev.mockReturnValue(false);
    carouselMocks.api.canScrollNext.mockReturnValue(false);
    onSelect(carouselMocks.api);
    await waitFor(() => {
      for (const button of screen.getAllByRole('button')) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    });
  });

  it('throws when a carousel child is rendered outside its provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CarouselContent />)).toThrow(
      'useCarousel must be used within a <Carousel />'
    );
    error.mockRestore();
  });
});
