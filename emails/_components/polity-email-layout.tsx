import type { CSSProperties, ReactNode } from 'react';
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from 'react-email';

const urls = {
  app: 'https://www.polity.live',
  imprint: 'https://www.polity.live/imprint',
  logo: 'https://www.polity.live/android-chrome-192x192.png',
  privacy: 'https://www.polity.live/privacy-policy',
  unsubscribe: '{{{RESEND_UNSUBSCRIBE_URL}}}',
} as const;

interface PolityEmailLayoutProps {
  children: ReactNode;
  eyebrow: string;
  language: 'de' | 'en';
  previewText: string;
}

export function PolityEmailLayout({
  children,
  eyebrow,
  language,
  previewText,
}: PolityEmailLayoutProps) {
  const footer =
    language === 'de'
      ? {
          app: 'Polity öffnen',
          imprint: 'Impressum',
          privacy: 'Datenschutz',
          reason:
            'Du erhältst diese E-Mail, weil deine bestätigte Polity-Adresse für den Newsletter eingetragen ist.',
          unsubscribe: 'Newsletter abbestellen',
        }
      : {
          app: 'Open Polity',
          imprint: 'Legal notice',
          privacy: 'Privacy',
          reason:
            'You are receiving this email because your confirmed Polity address is subscribed to the newsletter.',
          unsubscribe: 'Unsubscribe from newsletter',
        };

  return (
    <Html lang={language}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkModeStyles}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="polity-body" style={bodyStyle}>
        <Container className="polity-shell" style={shellStyle}>
          <Section className="polity-header" style={headerStyle}>
            <table role="presentation" cellPadding="0" cellSpacing="0" width="100%">
              <tbody>
                <tr>
                  <td style={logoCellStyle}>
                    <Img alt="Polity" height="42" src={urls.logo} style={logoStyle} width="42" />
                  </td>
                  <td>
                    <Text className="polity-wordmark" style={wordmarkStyle}>
                      POLITY
                    </Text>
                    <Text className="polity-eyebrow" style={headerEyebrowStyle}>
                      {eyebrow}
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section className="polity-content" style={contentStyle}>
            {children}
          </Section>

          <Section className="polity-footer" style={footerStyle}>
            <Hr className="polity-divider" style={footerDividerStyle} />
            <Text className="polity-footer-text" style={footerTextStyle}>
              {footer.reason}
            </Text>
            <Text className="polity-footer-links" style={footerLinksStyle}>
              <Link className="polity-footer-link" href={urls.app} style={footerLinkStyle}>
                {footer.app}
              </Link>
              <span style={separatorStyle}>·</span>
              <Link className="polity-footer-link" href={urls.imprint} style={footerLinkStyle}>
                {footer.imprint}
              </Link>
              <span style={separatorStyle}>·</span>
              <Link className="polity-footer-link" href={urls.privacy} style={footerLinkStyle}>
                {footer.privacy}
              </Link>
              <span style={separatorStyle}>·</span>
              <Link className="polity-footer-link" href={urls.unsubscribe} style={footerLinkStyle}>
                {footer.unsubscribe}
              </Link>
            </Text>
            <Text className="polity-address" style={addressStyle}>
              Polity · polity.live
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const polityEmailUrls = urls;

const darkModeStyles = `
  @media (prefers-color-scheme: dark) {
    .polity-body { background-color: #07110e !important; }
    .polity-shell { background-color: #101a16 !important; border-color: #2b3731 !important; }
    .polity-header { background-color: #0d1713 !important; border-color: #2b3731 !important; }
    .polity-content { background-color: #101a16 !important; }
    .polity-footer { background-color: #0d1713 !important; }
    .polity-wordmark, .polity-title, .polity-heading { color: #f4efe4 !important; }
    .polity-copy, .polity-footer-text { color: #d7d0c3 !important; }
    .polity-muted, .polity-address { color: #a8b1aa !important; }
    .polity-eyebrow, .polity-kicker, .polity-footer-link { color: #f2d39b !important; }
    .polity-panel { background-color: #18231f !important; border-color: #2b3731 !important; }
    .polity-divider { border-color: #2b3731 !important; }
  }

  @media screen and (max-width: 520px) {
    .polity-shell { width: 100% !important; }
    .polity-header, .polity-content, .polity-footer { padding-left: 22px !important; padding-right: 22px !important; }
    .polity-title { font-size: 32px !important; line-height: 38px !important; }
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

const logoStyle: CSSProperties = {
  borderRadius: '6px',
  display: 'block',
};

const wordmarkStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '17px',
  fontWeight: 750,
  lineHeight: '20px',
  margin: 0,
};

const headerEyebrowStyle: CSSProperties = {
  color: '#6c4a16',
  fontSize: '11px',
  fontWeight: 650,
  lineHeight: '16px',
  margin: '2px 0 0',
  textTransform: 'uppercase',
};

const contentStyle: CSSProperties = {
  backgroundColor: '#fffcf6',
  padding: '40px 34px 34px',
};

const footerStyle: CSSProperties = {
  backgroundColor: '#f2eee4',
  padding: '0 34px 28px',
};

const footerDividerStyle: CSSProperties = {
  border: 0,
  borderTop: '1px solid #d9d2c3',
  margin: 0,
};

const footerTextStyle: CSSProperties = {
  color: '#65706a',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '24px 0 12px',
};

const footerLinksStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: '20px',
  margin: 0,
};

const footerLinkStyle: CSSProperties = {
  color: '#6c4a16',
  textDecoration: 'underline',
};

const separatorStyle: CSSProperties = {
  color: '#a29a8b',
  padding: '0 7px',
};

const addressStyle: CSSProperties = {
  color: '#8b948f',
  fontSize: '11px',
  lineHeight: '16px',
  margin: '14px 0 0',
};
