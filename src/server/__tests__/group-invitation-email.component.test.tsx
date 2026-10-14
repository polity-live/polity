import { expect, it } from 'vitest';
import { render } from 'react-email';
import GroupInvitationEmail from '../../../emails/group-invitation';

it.each(['de', 'en'] as const)(
  'greets named and unnamed %s recipients and escapes special characters',
  async language => {
    const props = {
      language,
      groupName: 'Group',
      inviterName: 'Admin',
      roles: ['Member'],
      inviteUrl: 'http://localhost:3000/invite/test',
      expiresAt: '2026-11-10T12:00:00Z',
    };
    const both = await render(
      <GroupInvitationEmail {...props} firstName="Ada &" lastName="<Lovelace>" />
    );
    expect(both).toContain(`${language === 'de' ? 'Hallo' : 'Hello'} Ada &amp; &lt;Lovelace&gt;,`);
    expect(both).not.toContain('<Lovelace>');
    const partial = await render(<GroupInvitationEmail {...props} lastName="Lovelace" />);
    expect(partial).toContain(`${language === 'de' ? 'Hallo' : 'Hello'} Lovelace,`);
    const unnamed = await render(<GroupInvitationEmail {...props} />);
    expect(unnamed).toContain(`${language === 'de' ? 'Hallo' : 'Hello'},`);
  }
);

it.each(['de', 'en'] as const)(
  'renders a personal %s invitation without newsletter subscription claims',
  async language => {
    const html = await render(
      <GroupInvitationEmail
        language={language}
        groupName="A & B"
        inviterName="Admin"
        roles={['Member']}
        inviteUrl="http://localhost:3000/invite/test"
        expiresAt="2026-11-10T12:00:00Z"
      />
    );
    expect(html).toContain('http://localhost:3000/invite/test');
    expect(html).toContain('A &amp; B');
    expect(html).not.toContain('RESEND_UNSUBSCRIBE_URL');
    expect(html).not.toContain('Newsletter abbestellen');
    expect(html).not.toContain('subscribed to the newsletter');
    expect(html).toContain(language === 'de' ? 'ausdrücklich annimmst' : 'explicitly accepting');
  }
);
