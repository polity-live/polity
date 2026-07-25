import type { CSSProperties } from 'react';
import { Button, Heading, Hr, Section, Text } from 'react-email';

import { PolityEmailLayout, polityEmailUrls } from './_components/polity-email-layout';

export const newsletterContent = {
  de: {
    closing: 'Danke, dass du Polity mitgestaltest.',
    closingTeam: 'Dein Polity-Team',
    cta: 'Polity öffnen',
    eyebrow: 'Newsletter',
    feature:
      'Von der ersten Idee bis zur verbindlichen Abstimmung bleibt der gesamte Prozess nachvollziehbar. So wissen alle Beteiligten, was diskutiert wurde und wie es weitergeht.',
    featureLabel: 'Im Fokus',
    featureTitle: 'Gemeinsam zu klaren Entscheidungen',
    kicker: 'Neues aus der Polity-Community',
    lead: 'Polity bringt Diskussionen, Entscheidungen und gemeinsames Handeln an einen Ort. Hier findest du die wichtigsten Neuigkeiten und Ideen aus der Community.',
    next: 'Teile hier eine Vorschau auf kommende Funktionen, Veranstaltungen oder Entscheidungen und verlinke direkt zu den passenden Inhalten.',
    nextTitle: 'Was als Nächstes kommt',
    preview: 'Neue Möglichkeiten für Zusammenarbeit, Entscheidungen und Beteiligung bei Polity.',
    subject: 'Neues aus der Polity-Community',
    title: 'Mehr Überblick. Mehr Beteiligung.',
    updates:
      'Nutze diesen Bereich für Neuigkeiten aus Gruppen, laufende Beteiligungsprozesse oder einen kurzen Blick hinter die Kulissen von Polity.',
    updatesTitle: 'Was sich gerade bewegt',
  },
  en: {
    closing: 'Thank you for helping shape Polity.',
    closingTeam: 'The Polity team',
    cta: 'Open Polity',
    eyebrow: 'Newsletter',
    feature:
      'From the first idea to the final vote, the complete process remains transparent. Everyone can see what was discussed and what happens next.',
    featureLabel: 'In focus',
    featureTitle: 'Clear decisions, made together',
    kicker: 'News from the Polity community',
    lead: 'Polity brings discussions, decisions, and collective action together in one place. Here are the latest updates and ideas from the community.',
    next: 'Use this space to preview upcoming features, events, or decisions and link directly to the relevant content.',
    nextTitle: 'What comes next',
    preview: 'New ways to collaborate, decide, and participate with Polity.',
    subject: 'News from the Polity community',
    title: 'More clarity. More participation.',
    updates:
      'Use this section for news from groups, active participation processes, or a brief look behind the scenes at Polity.',
    updatesTitle: 'What is moving right now',
  },
} as const;

export default function NewsletterEmail({ language = 'de' }: { language?: 'de' | 'en' }) {
  const content = newsletterContent[language];
  return (
    <PolityEmailLayout eyebrow={content.eyebrow} language={language} previewText={content.preview}>
      <Text className="polity-kicker" style={kickerStyle}>
        {content.kicker}
      </Text>
      <Heading className="polity-title" style={titleStyle}>
        {content.title}
      </Heading>
      <Text className="polity-copy" style={leadStyle}>
        {content.lead}
      </Text>

      <Section className="polity-panel" style={featureStyle}>
        <Text className="polity-kicker" style={featureLabelStyle}>
          {content.featureLabel}
        </Text>
        <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
          {content.featureTitle}
        </Heading>
        <Text className="polity-copy" style={copyStyle}>
          {content.feature}
        </Text>
        <Button href={polityEmailUrls.app} style={primaryButtonStyle}>
          {content.cta}
        </Button>
      </Section>

      <Hr className="polity-divider" style={dividerStyle} />

      <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
        {content.updatesTitle}
      </Heading>
      <Text className="polity-copy" style={copyStyle}>
        {content.updates}
      </Text>

      <Heading className="polity-heading" as="h2" style={sectionTitleStyle}>
        {content.nextTitle}
      </Heading>
      <Text className="polity-copy" style={copyStyle}>
        {content.next}
      </Text>

      <Text className="polity-muted" style={closingStyle}>
        {content.closing}
        <br />
        {content.closingTeam}
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
