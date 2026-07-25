import type { CSSProperties, ReactNode } from 'react';
import { Button, Heading, Hr, Section, Text } from 'react-email';

import { PolityEmailLayout, polityEmailUrls } from './_components/polity-email-layout';

export const productUpdateContent = {
  de: {
    blocks: [
      {
        copy: 'Seiten, Dialoge und Werkzeuge folgen jetzt einem konsistenten Civic-Design. Informationen lassen sich schneller scannen, ohne dass wichtige Details verloren gehen.',
        label: 'Neu',
        title: 'Ein ruhigerer Arbeitsbereich',
      },
      {
        copy: 'Status, nächste Schritte und offene Entscheidungen werden deutlicher dargestellt. Das hilft besonders bei längeren Beteiligungs- und Abstimmungsprozessen.',
        label: 'Verbessert',
        title: 'Bessere Orientierung in Prozessen',
      },
      {
        copy: 'Zahlreiche kleinere Korrekturen reduzieren Unterbrechungen und sorgen für verlässlichere Aktualisierungen zwischen deinen Geräten.',
        label: 'Behoben',
        title: 'Stabilität im Alltag',
      },
    ],
    closing: 'Fragen oder Feedback? Antworte einfach auf diese E-Mail.',
    closingTeam: 'Dein Polity-Team',
    cta: 'Update in Polity ansehen',
    eyebrow: 'Produktupdate',
    kicker: 'Produktupdate · Juli 2026',
    lead: 'Dieses Update verbessert die tägliche Zusammenarbeit und macht wichtige Entscheidungen leichter auffindbar.',
    preview: 'Ein kompakter Überblick über die neuesten Verbesserungen bei Polity.',
    subject: 'Produktupdate: Neues bei Polity',
    title: 'Polity wird klarer und schneller.',
  },
  en: {
    blocks: [
      {
        copy: 'Pages, dialogs, and tools now follow a consistent civic design. Information is easier to scan without losing important detail.',
        label: 'New',
        title: 'A calmer workspace',
      },
      {
        copy: 'Statuses, next steps, and open decisions are presented more clearly, especially across longer participation and voting processes.',
        label: 'Improved',
        title: 'Better orientation in processes',
      },
      {
        copy: 'Numerous smaller fixes reduce interruptions and make updates across your devices more reliable.',
        label: 'Fixed',
        title: 'Everyday stability',
      },
    ],
    closing: 'Questions or feedback? Simply reply to this email.',
    closingTeam: 'The Polity team',
    cta: 'View the update in Polity',
    eyebrow: 'Product update',
    kicker: 'Product update · July 2026',
    lead: 'This update improves everyday collaboration and makes important decisions easier to find.',
    preview: 'A compact overview of the latest improvements to Polity.',
    subject: 'Product update: What is new at Polity',
    title: 'Polity is becoming clearer and faster.',
  },
} as const;

export default function ProductUpdateEmail({ language = 'de' }: { language?: 'de' | 'en' }) {
  const content = productUpdateContent[language];
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

      {content.blocks.map(block => (
        <UpdateBlock key={block.label} label={block.label} title={block.title}>
          {block.copy}
        </UpdateBlock>
      ))}

      <Section style={ctaSectionStyle}>
        <Button href={polityEmailUrls.app} style={primaryButtonStyle}>
          {content.cta}
        </Button>
      </Section>

      <Hr className="polity-divider" style={dividerStyle} />
      <Text className="polity-muted" style={closingStyle}>
        {content.closing}
        <br />
        {content.closingTeam}
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
