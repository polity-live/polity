import { Button, Heading, Text } from 'react-email';
import { PolityEmailLayout } from './_components/polity-email-layout';

export interface GroupInvitationEmailProps {
  language: 'de' | 'en';
  groupName: string;
  inviterName: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  inviteUrl: string;
  expiresAt: string;
}

GroupInvitationEmail.PreviewProps = {
  language: 'de',
  groupName: 'Beispielgruppe',
  inviterName: 'Alex',
  roles: ['Mitglied'],
  inviteUrl: `http://localhost:3000/invite/${'a'.repeat(43)}`,
  expiresAt: '2026-11-10T12:00:00Z',
} satisfies GroupInvitationEmailProps;
export default function GroupInvitationEmail({
  language,
  groupName,
  inviterName,
  firstName,
  lastName,
  roles,
  inviteUrl,
  expiresAt,
}: GroupInvitationEmailProps) {
  const de = language === 'de';
  const title = de ? `Einladung zur Gruppe ${groupName}` : `Invitation to ${groupName}`;
  const recipientName = [firstName, lastName].filter(Boolean).join(' ');
  return (
    <PolityEmailLayout
      language={language}
      invitation
      eyebrow={de ? 'Gruppeneinladung' : 'Group invitation'}
      previewText={title}
    >
      <Heading className="polity-title">{title}</Heading>
      <Text className="polity-copy">
        {recipientName ? `${de ? 'Hallo' : 'Hello'} ${recipientName},` : de ? 'Hallo,' : 'Hello,'}
      </Text>
      <Text className="polity-copy">
        {de
          ? `${inviterName} lädt dich zur Gruppe ${groupName} auf Polity ein.`
          : `${inviterName} invites you to join ${groupName} on Polity.`}
      </Text>
      <Text className="polity-copy">
        {de ? 'Vorgesehene Rollen: ' : 'Offered roles: '}
        {roles.join(', ')}
      </Text>
      <Button
        href={inviteUrl}
        style={{ background: '#17201c', color: '#fffcf6', padding: '14px 22px', borderRadius: 6 }}
      >
        {de ? 'Einladung ansehen' : 'View invitation'}
      </Button>
      <Text className="polity-copy">
        {de
          ? 'Melde dich mit dieser E-Mail-Adresse an oder erstelle ein Konto. Du wirst erst Mitglied, wenn du die Einladung ausdrücklich annimmst.'
          : 'Sign in with this email address or create an account. You only become a member after explicitly accepting the invitation.'}
      </Text>
      <Text className="polity-muted">
        {de ? 'Gültig bis: ' : 'Valid until: '}
        {new Date(expiresAt).toLocaleDateString(de ? 'de-DE' : 'en-GB', {
          timeZone: 'Europe/Berlin',
        })}
      </Text>
      <Text className="polity-muted">
        {de
          ? 'Wenn du nicht beitreten möchtest, kannst du diese Einladung ignorieren.'
          : 'If you do not want to join, you can ignore this invitation.'}
      </Text>
    </PolityEmailLayout>
  );
}
