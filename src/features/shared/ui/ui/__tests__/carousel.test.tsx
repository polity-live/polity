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
  ref: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [carouselMocks.ref, carouselMocks.api],
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
});
