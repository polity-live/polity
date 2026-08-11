/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en' }),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormFieldShell: ({ children }: { children: (props: { id: string }) => ReactNode }) =>
    children({ id: 'amount' }),
  FormControlInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  PageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/features/shared/ui/contact', () => ({
  ContactDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({ amount }: { amount: number }) => <>{amount}</>,
}));

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PricingPageView } from '../PricingPageView';

afterEach(cleanup);

describe('PricingPageView actions', () => {
  it('opens the enterprise contact surface through a stable action', () => {
    render(
      <PricingPageView
        title="Pricing"
        subtitle="Support Polity"
        tiers={[]}
        customAmount=""
        onCustomAmountChange={vi.fn()}
        customAmountLabel="Amount"
        philosophyTitle="Philosophy"
        philosophyIntro="Always"
        philosophyBold="free"
        philosophyAfterBold="."
        enterpriseTitle="Enterprise"
        enterpriseDescription="Contact us"
        enterpriseCta="Contact"
      />
    );

    const action = screen.getByRole('button', { name: 'Contact' });
    expect(action.getAttribute('data-action-id')).toBe('payments.pricing.enterprise-contact.open');
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);
  });
});
