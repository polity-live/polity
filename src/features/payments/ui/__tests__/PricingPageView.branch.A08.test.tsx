/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const language = vi.hoisted(() => ({ value: 'en' }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: language.value }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormFieldShell: ({ children }: { children: (props: { id: string }) => ReactNode }) =>
    children({ id: 'custom-amount' }),
  FormControlInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  PageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <header>
      {title}
      {description}
    </header>
  ),
  Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/features/shared/ui/contact', () => ({
  ContactDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({ amount }: { amount: number }) => (
    <span data-testid="amount">{amount}</span>
  ),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

import { PricingPageView, type PricingTierViewModel } from '../PricingPageView';

afterEach(cleanup);

const baseProps = {
  title: 'Pricing',
  subtitle: 'Support',
  customAmountLabel: 'Custom amount',
  philosophyTitle: 'Why',
  philosophyIntro: 'Always',
  philosophyBold: 'free',
  philosophyAfterBold: '.',
  enterpriseTitle: 'Enterprise',
  enterpriseDescription: 'Contact us',
  enterpriseCta: 'Contact',
};

function tiers(): PricingTierViewModel[] {
  return [
    {
      key: 'free',
      name: 'Free',
      price: '0',
      period: '',
      description: 'Free tier',
      features: ['One'],
      cta: 'Start',
    },
    {
      key: 'development',
      name: 'Dev',
      price: '10',
      period: '/month',
      description: 'Dev tier',
      features: ['Two'],
      cta: 'Support',
      highlighted: true,
    },
    {
      key: 'unknown',
      name: 'Other',
      price: '0',
      period: '',
      description: 'Other tier',
      features: [],
      cta: 'Other',
    },
    {
      key: 'custom',
      name: 'Custom',
      price: '',
      period: '/month',
      description: 'Custom tier',
      features: ['Any'],
      cta: 'Custom',
      acceptsCustomAmount: true,
    },
    {
      key: 'custom-once',
      name: 'Custom once',
      price: '',
      period: '',
      description: 'Once',
      features: [],
      cta: 'Once',
      acceptsCustomAmount: true,
    },
  ];
}

describe('PricingPageView', () => {
  it('renders fixed/custom variants and propagates valid custom input', () => {
    const onChange = vi.fn();
    const view = render(
      <PricingPageView
        {...baseProps}
        tiers={tiers()}
        customAmount="5"
        onCustomAmountChange={onChange}
      />
    );
    expect(screen.getAllByTestId('amount').map(node => node.textContent)).toEqual([
      '0',
      '10',
      '0',
      '5',
      '5',
    ]);
    fireEvent.change(screen.getAllByLabelText('Custom amount')[0], { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith('12');
    expect(view.container.textContent).toContain('The binding price');
    view.unmount();

    language.value = 'de';
    render(
      <PricingPageView
        {...baseProps}
        tiers={tiers()}
        customAmount="0"
        onCustomAmountChange={onChange}
      />
    );
    expect(screen.getAllByTestId('amount').map(node => node.textContent)).toEqual(['0', '10', '0']);
    expect(document.body.textContent).toContain('Der verbindliche Preis');
  });

  it('omits conversion for non-finite custom amounts', () => {
    render(
      <PricingPageView
        {...baseProps}
        tiers={tiers()}
        customAmount="invalid"
        onCustomAmountChange={vi.fn()}
      />
    );
    expect(screen.getAllByTestId('amount')).toHaveLength(3);
  });
});
