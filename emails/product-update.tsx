import type { CSSProperties, ReactNode } from 'react';
import { Button, Heading, Hr, Section, Text } from 'react-email';

import { PolityEmailLayout, polityEmailUrls } from './_components/polity-email-layout';

export const productUpdatePreviewText =
  'Ein kompakter Überblick über die neuesten Verbesserungen bei Polity.';

export default function ProductUpdateEmail() {
  return (
    <PolityEmailLayout eyebrow="Produktupdate" previewText={productUpdatePreviewText}>
      <Text className="polity-kicker" style={kickerStyle}>
        Produktupdate · Juli 2026
      </Text>
      <Heading className="polity-title" style={titleStyle}>
        Polity wird klarer und schneller.
      </Heading>
      <Text className="polity-copy" style={leadStyle}>
        Dieses Update verbessert die tägliche Zusammenarbeit und macht wichtige Entscheidungen
        leichter auffindbar.
      </Text>

      <UpdateBlock label="Neu" title="Ein ruhigerer Arbeitsbereich">
        Seiten, Dialoge und Werkzeuge folgen jetzt einem konsistenten Civic-Design. Informationen
        lassen sich schneller scannen, ohne dass wichtige Details verloren gehen.
      </UpdateBlock>

      <UpdateBlock label="Verbessert" title="Bessere Orientierung in Prozessen">
        Status, nächste Schritte und offene Entscheidungen werden deutlicher dargestellt. Das hilft
        besonders bei längeren Beteiligungs- und Abstimmungsprozessen.
      </UpdateBlock>

      <UpdateBlock label="Behoben" title="Stabilität im Alltag">
        Zahlreiche kleinere Korrekturen reduzieren Unterbrechungen und sorgen für verlässlichere
        Aktualisierungen zwischen deinen Geräten.
      </UpdateBlock>

      <Section style={ctaSectionStyle}>
        <Button href={polityEmailUrls.app} style={primaryButtonStyle}>
          Update in Polity ansehen
        </Button>
      </Section>

      <Hr className="polity-divider" style={dividerStyle} />
      <Text className="polity-muted" style={closingStyle}>
        Fragen oder Feedback? Antworte einfach auf diese E-Mail.
        <br />
        Dein Polity-Team
      </Text>
    </PolityEmailLayout>
  );
}

ProductUpdateEmail.PreviewProps = {};

interface UpdateBlockProps {
  children: ReactNode;
  label: string;
  title: string;
}

function UpdateBlock({ children, label, title }: UpdateBlockProps) {
  return (
    <Section className="polity-panel" style={updateBlockStyle}>
      <Text className="polity-kicker" style={updateLabelStyle}>
        {label}
      </Text>
      <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
        {title}
      </Heading>
      <Text className="polity-copy" style={copyStyle}>
        {children}
      </Text>
    </Section>
  );
}

const kickerStyle: CSSProperties = {
  color: '#6c4a16',
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: '18px',
  margin: '0 0 10px',
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '38px',
  fontWeight: 720,
  lineHeight: '44px',
  margin: '0 0 18px',
};

const leadStyle: CSSProperties = {
  color: '#3f4944',
  fontSize: '17px',
  lineHeight: '27px',
  margin: '0 0 30px',
};

const updateBlockStyle: CSSProperties = {
  backgroundColor: '#f2eee4',
  border: '1px solid #d9d2c3',
  borderRadius: '6px',
  marginBottom: '14px',
  padding: '20px 22px 18px',
};

const updateLabelStyle: CSSProperties = {
  ...kickerStyle,
  color: '#755015',
  marginBottom: '5px',
};

const sectionTitleStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '19px',
  fontWeight: 700,
  lineHeight: '26px',
  margin: '0 0 7px',
};

const copyStyle: CSSProperties = {
  color: '#4e5953',
  fontSize: '15px',
  lineHeight: '24px',
  margin: 0,
};

const ctaSectionStyle: CSSProperties = {
  paddingTop: '16px',
};

const primaryButtonStyle: CSSProperties = {
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

const dividerStyle: CSSProperties = {
  border: 0,
  borderTop: '1px solid #d9d2c3',
  margin: '30px 0 0',
};

const closingStyle: CSSProperties = {
  color: '#65706a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '24px 0 0',
};
