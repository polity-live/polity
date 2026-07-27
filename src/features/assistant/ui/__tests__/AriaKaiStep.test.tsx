/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARIA_KAI_AVATAR_URL } from '../../constants';
import { AriaKaiStep } from '../AriaKaiStep';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'onboarding.ariaKaiStep.title': 'Willkommen bei Polity!',
          'onboarding.ariaKaiStep.introLead': 'Wir sind ',
          'onboarding.ariaKaiStep.introEmphasis': 'Aria & Kai, deine persönlichen AI-Assistenten',
          'onboarding.ariaKaiStep.introText': ' – damit aus guten Ideen echte Veränderung wird.',
          'onboarding.ariaKaiStep.appHelp': 'In Polity begleiten wir dich bei deinen Vorhaben.',
          'onboarding.ariaKaiStep.quickTip': 'Schneller Tipp:',
          'onboarding.ariaKaiStep.tipText': 'Wir haben bereits eine Unterhaltung begonnen.',
          'onboarding.ariaKaiStep.assistantName': 'Aria & Kai',
          'onboarding.ariaKaiStep.assistantBadge': 'KI',
          'onboarding.ariaKaiStep.previewGreeting': 'Hey! Wir sind Aria & Kai.',
          'onboarding.ariaKaiStep.previewPrompt': 'Was sollte ich zuerst tun?',
          'onboarding.ariaKaiStep.continue': 'Weiter',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} {...props} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/auth/onboarding/OnboardingStepShell', () => ({
  OnboardingStepShell: ({
    actions,
    children,
  }: {
    actions: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      {actions}
    </div>
  ),
}));

afterEach(cleanup);

describe('AriaKaiStep', () => {
  it('uses the shared Aria & Kai avatar and keeps the initials fallback', () => {
    const { container } = render(<AriaKaiStep onNext={() => undefined} />);

    const avatarImage = container.querySelector<HTMLImageElement>(
      `img[src="${ARIA_KAI_AVATAR_URL}"]`
    );

    expect(avatarImage).toBeTruthy();
    expect(avatarImage?.parentElement?.parentElement?.className).toContain('justify-center');
    expect(container.textContent).toContain('AK');
  });

  it('uses the personal assistant positioning without subtitle or opt-out', () => {
    render(<AriaKaiStep onNext={() => undefined} />);

    expect(screen.getByText('Aria & Kai, deine persönlichen AI-Assistenten')).toBeTruthy();
    expect(screen.getByText(/In Polity begleiten wir dich/)).toBeTruthy();
    expect(screen.queryByText('Lerne Assistent Aria & Kai kennen')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
