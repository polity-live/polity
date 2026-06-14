import { Check } from 'lucide-react';

import { FormFieldShell, FormControlInput } from '@/features/shared/ui/form';
import { PageHeader, PageShell, Section } from '@/features/shared/ui/layout';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { ContactDialog } from '@/features/shared/ui/contact';
import { cn } from '@/features/shared/utils/utils';

export interface PricingTierViewModel {
  key: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  acceptsCustomAmount?: boolean;
}

interface PricingPageViewProps {
  title: string;
  subtitle: string;
  tiers: PricingTierViewModel[];
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  customAmountLabel: string;
  philosophyTitle: string;
  philosophyIntro: string;
  philosophyBold: string;
  philosophyAfterBold: string;
  enterpriseTitle: string;
  enterpriseDescription: string;
  enterpriseCta: string;
}

export function PricingPageView({
  title,
  subtitle,
  tiers,
  customAmount,
  onCustomAmountChange,
  customAmountLabel,
  philosophyTitle,
  philosophyIntro,
  philosophyBold,
  philosophyAfterBold,
  enterpriseTitle,
  enterpriseDescription,
  enterpriseCta,
}: PricingPageViewProps) {
  return (
    <PageShell contentClassName="max-w-6xl py-12 sm:py-16">
      <PageHeader title={title} description={subtitle} className="items-center text-center" />

      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map(tier => (
            <Card
              key={tier.key}
              className={cn('flex h-full flex-col', tier.highlighted && 'border-primary shadow-md')}
            >
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="mt-2">
                  {tier.acceptsCustomAmount ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{'\u20ac'}</span>
                      <FormFieldShell label={customAmountLabel} labelClassName="sr-only">
                        {({ id }) => (
                          <FormControlInput
                            id={id}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={customAmount}
                            onChange={event => onCustomAmountChange(event.target.value)}
                            className="h-auto w-20 rounded-none border-0 border-b-2 px-1 py-0 text-3xl font-bold focus-visible:ring-0"
                          />
                        )}
                      </FormFieldShell>
                      {tier.period ? (
                        <span className="text-muted-foreground">{tier.period}</span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">{tier.price}</span>
                      {tier.period ? (
                        <span className="text-muted-foreground">{tier.period}</span>
                      ) : null}
                    </>
                  )}
                </div>
                <CardDescription className="mt-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="grow">
                <ul className="space-y-2">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full"
                  variant={tier.highlighted ? 'default' : 'outline'}
                >
                  <a href="/auth">{tier.cta}</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-muted/50 -mx-4 px-4 py-12 text-center sm:-mx-6 lg:-mx-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="text-2xl font-bold">{philosophyTitle}</h2>
          <p className="text-muted-foreground">
            {philosophyIntro} <strong>{philosophyBold}</strong>
            {philosophyAfterBold}
          </p>
        </div>
      </Section>

      <Section className="text-center">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">{enterpriseTitle}</h2>
          <p className="text-muted-foreground">{enterpriseDescription}</p>
          <ContactDialog>
            <Button variant="outline" size="lg">
              {enterpriseCta}
            </Button>
          </ContactDialog>
        </div>
      </Section>
    </PageShell>
  );
}
