import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';
import { render } from 'react-email';

export const supabaseAuthTemplateSlugs = [
  'confirmation',
  'invite',
  'magic_link',
  'email_change',
  'recovery',
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
] as const;

export type SupabaseAuthTemplateSlug = (typeof supabaseAuthTemplateSlugs)[number];
export type SupabaseAuthTemplateLanguage = 'de' | 'en';

interface LocalizedContent {
  body: string[];
  button?: string;
  code?: string;
  codeLabel?: string;
  eyebrow: string;
  title: string;
  warning: string;
}

export interface SupabaseAuthTemplateDefinition {
  component: ReactElement;
  contentField: string;
  fileName: string;
  slug: SupabaseAuthTemplateSlug;
  subject: string;
  subjectField: string;
}

const goIfGerman = '{{ if eq .Data.language `de` }}';
const goElse = '{{ else }}';
const goEnd = '{{ end }}';
const goLanguage = `${goIfGerman}de${goElse}en${goEnd}`;

const subjects: Record<SupabaseAuthTemplateSlug, Record<SupabaseAuthTemplateLanguage, string>> = {
  confirmation: {
    de: 'Bestätige deine E-Mail-Adresse für Polity',
    en: 'Confirm your email address for Polity',
  },
  invite: {
    de: 'Du wurdest zu Polity eingeladen',
    en: 'You have been invited to Polity',
  },
  magic_link: {
    de: '{{ .Token }} ist dein Polity-Anmeldecode',
    en: '{{ .Token }} is your Polity sign-in code',
  },
  email_change: {
    de: 'Bestätige deine neue E-Mail-Adresse für Polity',
    en: 'Confirm your new email address for Polity',
  },
  recovery: {
    de: 'Setze dein Polity-Passwort zurück',
    en: 'Reset your Polity password',
  },
  reauthentication: {
    de: '{{ .Token }} ist dein Polity-Bestätigungscode',
    en: '{{ .Token }} is your Polity verification code',
  },
  password_changed_notification: {
    de: 'Dein Polity-Passwort wurde geändert',
    en: 'Your Polity password was changed',
  },
  email_changed_notification: {
    de: 'Deine Polity-E-Mail-Adresse wurde geändert',
    en: 'Your Polity email address was changed',
  },
};

const content: Record<
  SupabaseAuthTemplateSlug,
  Record<SupabaseAuthTemplateLanguage, LocalizedContent>
> = {
  confirmation: {
    de: {
      body: [
        'Danke für deine Registrierung. Bestätige deine E-Mail-Adresse, um dein Polity-Konto zu aktivieren.',
      ],
      button: 'E-Mail-Adresse bestätigen',
      eyebrow: 'Konto bestätigen',
      title: 'Willkommen bei Polity.',
      warning:
        'Falls du kein Polity-Konto erstellt hast, kannst du diese E-Mail einfach ignorieren.',
    },
    en: {
      body: [
        'Thank you for signing up. Confirm your email address to activate your Polity account.',
      ],
      button: 'Confirm email address',
      eyebrow: 'Confirm account',
      title: 'Welcome to Polity.',
      warning: 'If you did not create a Polity account, you can safely ignore this email.',
    },
  },
  invite: {
    de: {
      body: [
        'Du wurdest eingeladen, Polity zu nutzen. Nimm die Einladung an, um dein Konto einzurichten.',
      ],
      button: 'Einladung annehmen',
      eyebrow: 'Einladung',
      title: 'Gestalte Entscheidungen gemeinsam.',
      warning:
        'Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail einfach ignorieren.',
    },
    en: {
      body: ['You have been invited to use Polity. Accept the invitation to set up your account.'],
      button: 'Accept invitation',
      eyebrow: 'Invitation',
      title: 'Shape decisions together.',
      warning: 'If you were not expecting this invitation, you can safely ignore this email.',
    },
  },
  magic_link: {
    de: {
      body: [
        'Verwende den folgenden einmaligen Code oder öffne den sicheren Link, um dich bei Polity anzumelden.',
      ],
      button: 'Sicher bei Polity anmelden',
      code: '{{ .Token }}',
      codeLabel: 'Dein Anmeldecode',
      eyebrow: 'Sichere Anmeldung',
      title: 'Dein Zugang zu Polity.',
      warning:
        'Falls du diese Anmeldung nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.',
    },
    en: {
      body: ['Use the one-time code below or open the secure link to sign in to Polity.'],
      button: 'Sign in to Polity securely',
      code: '{{ .Token }}',
      codeLabel: 'Your sign-in code',
      eyebrow: 'Secure sign-in',
      title: 'Your access to Polity.',
      warning: 'If you did not request this sign-in, you can safely ignore this email.',
    },
  },
  email_change: {
    de: {
      body: ['Bestätige {{ .NewEmail }} als neue E-Mail-Adresse für dein Polity-Konto.'],
      button: 'Neue E-Mail-Adresse bestätigen',
      eyebrow: 'E-Mail-Adresse ändern',
      title: 'Bestätige deine neue Adresse.',
      warning:
        'Falls du diese Änderung nicht angefordert hast, bestätige sie nicht und sichere dein Konto.',
    },
    en: {
      body: ['Confirm {{ .NewEmail }} as the new email address for your Polity account.'],
      button: 'Confirm new email address',
      eyebrow: 'Change email address',
      title: 'Confirm your new address.',
      warning: 'If you did not request this change, do not confirm it and secure your account.',
    },
  },
  recovery: {
    de: {
      body: ['Wir haben eine Anfrage erhalten, das Passwort für dein Polity-Konto zurückzusetzen.'],
      button: 'Passwort zurücksetzen',
      eyebrow: 'Passwort zurücksetzen',
      title: 'Wähle ein neues Passwort.',
      warning:
        'Falls du das Zurücksetzen nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.',
    },
    en: {
      body: ['We received a request to reset the password for your Polity account.'],
      button: 'Reset password',
      eyebrow: 'Reset password',
      title: 'Choose a new password.',
      warning: 'If you did not request a password reset, you can safely ignore this email.',
    },
  },
  reauthentication: {
    de: {
      body: [
        'Verwende diesen einmaligen Code, um deine Identität für die angeforderte Kontoänderung zu bestätigen.',
      ],
      code: '{{ .Token }}',
      codeLabel: 'Dein Bestätigungscode',
      eyebrow: 'Identität bestätigen',
      title: 'Bestätige, dass du es bist.',
      warning:
        'Falls du keine sicherheitsrelevante Änderung angefordert hast, ändere dein Passwort und kontaktiere uns.',
    },
    en: {
      body: ['Use this one-time code to verify your identity for the requested account change.'],
      code: '{{ .Token }}',
      codeLabel: 'Your verification code',
      eyebrow: 'Verify identity',
      title: 'Confirm it is you.',
      warning:
        'If you did not request a security-sensitive change, reset your password and contact us.',
    },
  },
  password_changed_notification: {
    de: {
      body: ['Das Passwort für dein Polity-Konto wurde vor Kurzem geändert.'],
      eyebrow: 'Sicherheitsmeldung',
      title: 'Dein Passwort wurde geändert.',
      warning:
        'Falls du diese Änderung nicht vorgenommen hast, setze dein Passwort sofort zurück und kontaktiere uns.',
    },
    en: {
      body: ['The password for your Polity account was recently changed.'],
      eyebrow: 'Security notice',
      title: 'Your password was changed.',
      warning: 'If you did not make this change, reset your password immediately and contact us.',
    },
  },
  email_changed_notification: {
    de: {
      body: [
        'Die E-Mail-Adresse deines Polity-Kontos wurde von {{ .OldEmail }} zu {{ .Email }} geändert.',
      ],
      eyebrow: 'Sicherheitsmeldung',
      title: 'Deine E-Mail-Adresse wurde geändert.',
      warning:
        'Falls du diese Änderung nicht vorgenommen hast, sichere dein Konto und kontaktiere uns sofort.',
    },
    en: {
      body: [
        'The email address for your Polity account was changed from {{ .OldEmail }} to {{ .Email }}.',
      ],
      eyebrow: 'Security notice',
      title: 'Your email address was changed.',
      warning: 'If you did not make this change, secure your account and contact us immediately.',
    },
  },
};

const fields: Record<
  SupabaseAuthTemplateSlug,
  Omit<SupabaseAuthTemplateDefinition, 'component' | 'slug' | 'subject'>
> = {
  confirmation: {
    contentField: 'mailer_templates_confirmation_content',
    fileName: 'confirm-signup.html',
    subjectField: 'mailer_subjects_confirmation',
  },
  invite: {
    contentField: 'mailer_templates_invite_content',
    fileName: 'invite.html',
    subjectField: 'mailer_subjects_invite',
  },
  magic_link: {
    contentField: 'mailer_templates_magic_link_content',
    fileName: 'magic-link.html',
    subjectField: 'mailer_subjects_magic_link',
  },
  email_change: {
    contentField: 'mailer_templates_email_change_content',
    fileName: 'confirm-email-change.html',
    subjectField: 'mailer_subjects_email_change',
  },
  recovery: {
    contentField: 'mailer_templates_recovery_content',
    fileName: 'reset-password.html',
    subjectField: 'mailer_subjects_recovery',
  },
  reauthentication: {
    contentField: 'mailer_templates_reauthentication_content',
    fileName: 'reauthentication.html',
    subjectField: 'mailer_subjects_reauthentication',
  },
  password_changed_notification: {
    contentField: 'mailer_templates_password_changed_notification_content',
    fileName: 'password-changed.html',
    subjectField: 'mailer_subjects_password_changed_notification',
  },
  email_changed_notification: {
    contentField: 'mailer_templates_email_changed_notification_content',
    fileName: 'email-changed.html',
    subjectField: 'mailer_subjects_email_changed_notification',
  },
};

export function getSupabaseAuthTemplateDefinition(
  slug: SupabaseAuthTemplateSlug
): SupabaseAuthTemplateDefinition {
  const subject = localizedSubject(slug);
  return {
    ...fields[slug],
    component: (
      <PolityAuthEmail subject={subject}>
        {goIfGerman}
        <LocalizedEmailContent content={content[slug].de} slug={slug} />
        {goElse}
        <LocalizedEmailContent content={content[slug].en} slug={slug} />
        {goEnd}
      </PolityAuthEmail>
    ),
    slug,
    subject,
  };
}

export async function renderSupabaseAuthTemplate(slug: SupabaseAuthTemplateSlug) {
  return render(getSupabaseAuthTemplateDefinition(slug).component);
}

function localizedSubject(slug: SupabaseAuthTemplateSlug) {
  return `${goIfGerman}${subjects[slug].de}${goElse}${subjects[slug].en}${goEnd}`;
}

function PolityAuthEmail({ children, subject }: { children: ReactNode; subject: string }) {
  return (
    <Html lang={goLanguage}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>{subject}</title>
        <style>{darkModeStyles}</style>
      </Head>
      <Preview>{subject}</Preview>
      <Body className="polity-auth-body" style={bodyStyle}>
        <Container className="polity-auth-shell" style={shellStyle}>
          <Section className="polity-auth-header" style={headerStyle}>
            <table role="presentation" cellPadding="0" cellSpacing="0" width="100%">
              <tbody>
                <tr>
                  <td style={logoCellStyle}>
                    <Img
                      alt="Polity"
                      height="42"
                      src="{{ .SiteURL }}/android-chrome-192x192.png"
                      style={logoStyle}
                      width="42"
                    />
                  </td>
                  <td>
                    <Text className="polity-auth-wordmark" style={wordmarkStyle}>
                      POLITY
                    </Text>
                    <Text className="polity-auth-brandline" style={brandlineStyle}>
                      Participation · decisions · action
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Section className="polity-auth-content" style={contentStyle}>
            {children}
          </Section>
          <Section className="polity-auth-footer" style={footerStyle}>
            <Hr className="polity-auth-divider" style={dividerStyle} />
            <Text className="polity-auth-footer-copy" style={footerCopyStyle}>
              Polity ·{' '}
              <Link href="{{ .SiteURL }}" style={footerLinkStyle}>
                polity.live
              </Link>{' '}
              ·{' '}
              <Link href="mailto:team@polity.live" style={footerLinkStyle}>
                team@polity.live
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function LocalizedEmailContent({
  content: localized,
  slug,
}: {
  content: LocalizedContent;
  slug: SupabaseAuthTemplateSlug;
}) {
  return (
    <>
      <Text className="polity-auth-eyebrow" style={eyebrowStyle}>
        {localized.eyebrow}
      </Text>
      <Heading className="polity-auth-title" style={titleStyle}>
        {localized.title}
      </Heading>
      {localized.body.map(paragraph => (
        <Text className="polity-auth-copy" key={paragraph} style={copyStyle}>
          {paragraph}
        </Text>
      ))}
      {localized.code ? (
        <Section className="polity-auth-code-panel" style={codePanelStyle}>
          <Text className="polity-auth-code-label" style={codeLabelStyle}>
            {localized.codeLabel}
          </Text>
          <Text className="polity-auth-code" style={codeStyle}>
            {localized.code}
          </Text>
        </Section>
      ) : null}
      {localized.button ? (
        <Section style={buttonSectionStyle}>
          <Button href="{{ .ConfirmationURL }}" style={buttonStyle}>
            {localized.button}
          </Button>
        </Section>
      ) : null}
      {localized.button ? (
        <Text className="polity-auth-muted" style={fallbackStyle}>
          {slug === 'magic_link' ? 'Link: ' : ''}
          <Link href="{{ .ConfirmationURL }}" style={fallbackLinkStyle}>
            {'{{ .ConfirmationURL }}'}
          </Link>
        </Text>
      ) : null}
      <Section className="polity-auth-warning" style={warningStyle}>
        <Text className="polity-auth-warning-copy" style={warningCopyStyle}>
          {localized.warning}
        </Text>
      </Section>
    </>
  );
}

const darkModeStyles = `
  @media (prefers-color-scheme: dark) {
    .polity-auth-body { background-color: #07110e !important; }
    .polity-auth-shell, .polity-auth-content { background-color: #101a16 !important; border-color: #2b3731 !important; }
    .polity-auth-header, .polity-auth-footer { background-color: #0d1713 !important; }
    .polity-auth-wordmark, .polity-auth-title, .polity-auth-code { color: #f4efe4 !important; }
    .polity-auth-copy, .polity-auth-warning-copy { color: #d7d0c3 !important; }
    .polity-auth-brandline, .polity-auth-muted, .polity-auth-footer-copy { color: #a8b1aa !important; }
    .polity-auth-eyebrow, .polity-auth-code-label { color: #f2d39b !important; }
    .polity-auth-code-panel { background-color: #18231f !important; border-color: #45534c !important; }
    .polity-auth-warning { background-color: #282117 !important; border-color: #725b32 !important; }
    .polity-auth-divider { border-color: #2b3731 !important; }
  }
  @media screen and (max-width: 520px) {
    .polity-auth-shell { width: 100% !important; }
    .polity-auth-header, .polity-auth-content, .polity-auth-footer { padding-left: 22px !important; padding-right: 22px !important; }
    .polity-auth-title { font-size: 28px !important; line-height: 35px !important; }
  }
`;

const bodyStyle: CSSProperties = {
  backgroundColor: '#f7f5ef',
  color: '#17201c',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: '32px 12px',
};
const shellStyle: CSSProperties = {
  backgroundColor: '#fffcf6',
  border: '1px solid #d9d2c3',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '600px',
  overflow: 'hidden',
  width: '100%',
};
const headerStyle: CSSProperties = {
  backgroundColor: '#f2eee4',
  borderBottom: '1px solid #d9d2c3',
  padding: '22px 34px',
};
const logoCellStyle: CSSProperties = { paddingRight: '13px', width: '42px' };
const logoStyle: CSSProperties = { borderRadius: '6px', display: 'block' };
const wordmarkStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '17px',
  fontWeight: 750,
  lineHeight: '20px',
  margin: 0,
};
const brandlineStyle: CSSProperties = {
  color: '#6c4a16',
  fontSize: '10px',
  fontWeight: 650,
  lineHeight: '15px',
  margin: '2px 0 0',
  textTransform: 'uppercase',
};
const contentStyle: CSSProperties = {
  backgroundColor: '#fffcf6',
  padding: '40px 34px 34px',
};
const eyebrowStyle: CSSProperties = {
  color: '#6c4a16',
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: '18px',
  margin: '0 0 9px',
  textTransform: 'uppercase',
};
const titleStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '32px',
  fontWeight: 720,
  lineHeight: '40px',
  margin: '0 0 18px',
};
const copyStyle: CSSProperties = {
  color: '#3f4944',
  fontSize: '16px',
  lineHeight: '25px',
  margin: '0 0 22px',
};
const codePanelStyle: CSSProperties = {
  backgroundColor: '#f2eee4',
  border: '1px solid #c9c0af',
  borderRadius: '6px',
  margin: '8px 0 24px',
  padding: '18px 22px',
};
const codeLabelStyle: CSSProperties = {
  color: '#6c4a16',
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: '16px',
  margin: '0 0 6px',
  textTransform: 'uppercase',
};
const codeStyle: CSSProperties = {
  color: '#17201c',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '30px',
  fontWeight: 750,
  lineHeight: '36px',
  margin: 0,
};
const buttonSectionStyle: CSSProperties = { margin: '4px 0 22px' };
const buttonStyle: CSSProperties = {
  backgroundColor: '#12362d',
  borderRadius: '5px',
  color: '#fffcf6',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: '18px',
  padding: '12px 18px',
  textDecoration: 'none',
};
const fallbackStyle: CSSProperties = {
  color: '#737d77',
  fontSize: '11px',
  lineHeight: '17px',
  margin: '0 0 24px',
  overflowWrap: 'anywhere',
};
const fallbackLinkStyle: CSSProperties = { color: '#6c4a16', textDecoration: 'underline' };
const warningStyle: CSSProperties = {
  backgroundColor: '#f5ecd8',
  border: '1px solid #d2ad63',
  borderRadius: '6px',
  marginTop: '12px',
  padding: '15px 17px',
};
const warningCopyStyle: CSSProperties = {
  color: '#5b4a2c',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
};
const footerStyle: CSSProperties = { backgroundColor: '#f2eee4', padding: '0 34px 26px' };
const dividerStyle: CSSProperties = {
  border: 0,
  borderTop: '1px solid #d9d2c3',
  margin: 0,
};
const footerCopyStyle: CSSProperties = {
  color: '#7f8983',
  fontSize: '11px',
  lineHeight: '18px',
  margin: '22px 0 0',
  textAlign: 'center',
};
const footerLinkStyle: CSSProperties = { color: '#6c4a16', textDecoration: 'underline' };
