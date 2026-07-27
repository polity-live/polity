/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InfoTabs } from '../InfoTabs';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

describe('InfoTabs contact cards', () => {
  it('allows linked contact and social cards to shrink and wrap long values', () => {
    const email = 'averylongunbrokenemailaddress@averylongunbrokendomain.example';
    const website = 'https://example.test/averylongunbrokenwebsitepathwithoutseparators';
    const instagram = 'averylongunbrokeninstagramhandlewithoutseparators';

    render(
      <InfoTabs
        contact={{
          email,
          website,
          instagram,
        }}
      />
    );

    for (const value of [email, website, instagram]) {
      const valueElement = screen.getByText(value);
      const card = valueElement.closest('a');

      expect(valueElement.className).toContain('[overflow-wrap:anywhere]');
      expect(card?.className).toContain('w-full');
      expect(card?.className).toContain('min-w-0');
      expect(card?.firstElementChild?.className).toContain('shrink-0');
    }
  });

  it('allows unlinked location cards to shrink and wrap long values', () => {
    const country = 'AveryLongUnbrokenCountryOrLocationValueWithoutSeparators';

    render(<InfoTabs contact={{ country }} />);

    const valueElement = screen.getByText(country);
    const card = valueElement.parentElement?.parentElement;

    expect(valueElement.className).toContain('[overflow-wrap:anywhere]');
    expect(card?.tagName).toBe('DIV');
    expect(card?.className).toContain('w-full');
    expect(card?.className).toContain('min-w-0');
    expect(card?.firstElementChild?.className).toContain('shrink-0');
  });
});
