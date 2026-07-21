import type { CSSProperties } from 'react';
import { Button, Heading, Hr, Section, Text } from 'react-email';

import { PolityEmailLayout, polityEmailUrls } from './_components/polity-email-layout';

export const newsletterPreviewText =
  'Neue Möglichkeiten für Zusammenarbeit, Entscheidungen und Beteiligung bei Polity.';

export default function NewsletterEmail() {
  return (
    <PolityEmailLayout eyebrow="Newsletter" previewText={newsletterPreviewText}>
      <Text className="polity-kicker" style={kickerStyle}>
        Neues aus der Polity-Community
      </Text>
      <Heading className="polity-title" style={titleStyle}>
        Mehr Überblick. Mehr Beteiligung.
      </Heading>
      <Text className="polity-copy" style={leadStyle}>
        Polity bringt Diskussionen, Entscheidungen und gemeinsames Handeln an einen Ort. Hier
        findest du die wichtigsten Neuigkeiten und Ideen aus der Community.
      </Text>

      <Section className="polity-panel" style={featureStyle}>
        <Text className="polity-kicker" style={featureLabelStyle}>
          Im Fokus
        </Text>
        <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
          Gemeinsam zu klaren Entscheidungen
        </Heading>
        <Text className="polity-copy" style={copyStyle}>
          Von der ersten Idee bis zur verbindlichen Abstimmung bleibt der gesamte Prozess
          nachvollziehbar. So wissen alle Beteiligten, was diskutiert wurde und wie es weitergeht.
        </Text>
        <Button href={polityEmailUrls.app} style={primaryButtonStyle}>
          Polity öffnen
        </Button>
      </Section>

      <Hr className="polity-divider" style={dividerStyle} />

      <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
        Was sich gerade bewegt
      </Heading>
      <Text className="polity-copy" style={copyStyle}>
        Nutze diesen Bereich für Neuigkeiten aus Gruppen, laufende Beteiligungsprozesse oder einen
        kurzen Blick hinter die Kulissen von Polity.
      </Text>

      <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
        Was als Nächstes kommt
      </Heading>
      <Text className="polity-copy" style={copyStyle}>
        Teile hier eine Vorschau auf kommende Funktionen, Veranstaltungen oder Entscheidungen und
        verlinke direkt zu den passenden Inhalten.
      </Text>

      <Text className="polity-muted" style={closingStyle}>
        Danke, dass du Polity mitgestaltest.
        <br />
        Dein Polity-Team
      </Text>
    </PolityEmailLayout>
  );
}

NewsletterEmail.PreviewProps = {};

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

const featureStyle: CSSProperties = {
  backgroundColor: '#f5ecd8',
  border: '1px solid #d2ad63',
  borderRadius: '6px',
  padding: '24px',
};

const featureLabelStyle: CSSProperties = {
  ...kickerStyle,
  color: '#755015',
  marginBottom: '7px',
};

const sectionTitleStyle: CSSProperties = {
  color: '#17201c',
  fontSize: '21px',
  fontWeight: 700,
  lineHeight: '28px',
  margin: '0 0 10px',
};

const copyStyle: CSSProperties = {
  color: '#4e5953',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 20px',
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
  margin: '30px 0',
};

const closingStyle: CSSProperties = {
  color: '#65706a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '30px 0 0',
};
