import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { CityDesignChangeRequestPanel } from '../CityDesignChangeRequestPanel';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

it('closes the actual city-design request card with native keyboard activation and returns focus to its opener', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={trigger} onClick={() => setOpen(true)}>
          Open request
        </button>
        {open && (
          <CityDesignChangeRequestPanel
            compact
            changeRequest={{
              id: 'city-request',
              source_type: 'city_design_object',
              title: 'Add retail building',
              change_type: 'insert',
              status: 'open',
              voting_status: 'open',
            }}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />
        )}
      </>
    );
  }
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open request' });
  opener.focus();
  await userEvent.keyboard('{Enter}');
  const close = screen.getByRole('button', {
    name: 'features.amendments.cityDesign.changeRequests.close',
  });
  expect(close.getAttribute('data-action-id')).toBe('amendments.city-cr.close.details');
  close.focus();
  expect(document.activeElement).toBe(close);
  await userEvent.keyboard(' ');
  expect(
    screen.queryByRole('button', { name: 'features.amendments.cityDesign.changeRequests.close' })
  ).toBeNull();
  expect(document.activeElement).toBe(opener);
  await userEvent.keyboard('{Enter}');
  expect(
    screen.getByRole('button', { name: 'features.amendments.cityDesign.changeRequests.close' })
  ).toBeTruthy();
});
