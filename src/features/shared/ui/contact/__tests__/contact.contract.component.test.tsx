/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const controller = vi.hoisted(() => ({
  useContactDialogController: vi.fn(() => ({ open: false, onOpenChange: vi.fn() })),
}));

vi.mock('@/features/shared/hooks/useContactDialogController', () => controller);
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ContactDialog } from '../ContactDialog';
import { ContactDialogView } from '../ContactDialogView';
import { ContactLinksSection } from '../ContactLinksSection';

afterEach(cleanup);

describe('contact UI contracts', () => {
  it('connects the contact dialog controller to the trigger view', () => {
    render(
      <ContactDialog>
        <button type="button">Contact us</button>
      </ContactDialog>
    );

    expect(controller.useContactDialogController).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders deterministic email and issue destinations and reports close changes', async () => {
    const onOpenChange = vi.fn();
    render(
      <ContactDialogView open onOpenChange={onOpenChange}>
        <button type="button">Contact us</button>
      </ContactDialogView>
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    const email = screen.getByRole('link', { name: /common.contactDialog.email/ });
    const issues = screen.getByRole('link', { name: /common.contactDialog.github/ });
    expect(email.getAttribute('href')).toMatch(/^mailto:/);
    expect(issues.getAttribute('href')).toMatch(/^https:\/\/github\.com\//);
    expect(issues.getAttribute('target')).toBe('_blank');
    expect(issues.getAttribute('rel')).toBe('noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('renders primary and social fields, propagates changes, and supports empty sections', () => {
    const onEmailChange = vi.fn();
    const onSocialChange = vi.fn();
    const fields = {
      primaryFields: [
        {
          id: 'contact-email',
          label: 'Contact email',
          placeholder: 'name@example.test',
          value: 'ada@example.test',
          onChange: onEmailChange,
          icon: <span>@</span>,
          type: 'email' as const,
          helpText: 'Public contact address',
          validator: (value: string) => value.includes('@'),
          autoComplete: 'email',
        },
      ],
      socialFields: [
        {
          id: 'social-url',
          label: 'Social URL',
          placeholder: 'https://example.test',
          value: '',
          onChange: onSocialChange,
          icon: <span>#</span>,
        },
      ],
    };
    const { rerender } = render(
      <ContactLinksSection
        title="Contact links"
        description="How people reach you"
        socialTitle="Social profiles"
        socialDescription="Optional public profiles"
        {...fields}
      />
    );

    fireEvent.change(screen.getByLabelText('Contact email'), {
      target: { value: 'grace@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Social URL'), {
      target: { value: 'https://social.example.test/grace' },
    });
    expect(onEmailChange).toHaveBeenCalledWith('grace@example.test');
    expect(onSocialChange).toHaveBeenCalledWith('https://social.example.test/grace');
    expect(screen.getByText('Social profiles')).toBeTruthy();

    rerender(<ContactLinksSection title="Contact links" description="No links yet" />);
    expect(screen.queryByLabelText('Contact email')).toBeNull();
    expect(screen.getByText('No links yet')).toBeTruthy();

    rerender(
      <ContactLinksSection
        title="Contact links"
        description="Multiple"
        primaryFields={[fields.primaryFields[0], { ...fields.primaryFields[0], id: 'second' }]}
        socialFields={fields.socialFields}
      />
    );
    expect(screen.getAllByLabelText('Contact email')).toHaveLength(2);
  });
});
