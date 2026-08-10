/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editors: [] as Record<string, any>[],
  inputs: [] as Record<string, any>[],
  selects: [] as Record<string, any>[],
  membershipTables: [] as Record<string, any>[],
  contactProps: undefined as Record<string, any> | undefined,
  hashtagProps: undefined as Record<string, any> | undefined,
  passwordViewProps: undefined as Record<string, any> | undefined,
  confirmationProps: undefined as Record<string, any> | undefined,
  validationCalls: [] as unknown[][],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));
vi.mock('@/features/shared/ui/form/MiniPlateEditor', () => ({
  MiniPlateEditor: (props: Record<string, any>) => {
    mocks.editors.push(props);
    return <div>mini-editor</div>;
  },
}));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: (props: Record<string, any>) => {
    mocks.inputs.push(props);
    return <div>{props.id}</div>;
  },
}));
vi.mock('@/features/shared/ui/form/SelectField', () => ({
  SelectField: (props: Record<string, any>) => {
    mocks.selects.push(props);
    return <div>select-field</div>;
  },
}));
vi.mock('@/features/shared/logic/inputValidation', () => ({
  hasMinLength: (...args: unknown[]) => {
    mocks.validationCalls.push(['hasMinLength', ...args]);
    return true;
  },
  isOptionalMinLength: (...args: unknown[]) => {
    mocks.validationCalls.push(['isOptionalMinLength', ...args]);
    return true;
  },
  isValidOptionalEmailAddress: (...args: unknown[]) => {
    mocks.validationCalls.push(['email', ...args]);
    return true;
  },
  isValidOptionalUrlLike: (...args: unknown[]) => {
    mocks.validationCalls.push(['url', ...args]);
    return true;
  },
  isValidOptionalSocialInput: (...args: unknown[]) => {
    mocks.validationCalls.push(['social', ...args]);
    return true;
  },
}));
vi.mock('@/features/shared/ui/contact/ContactLinksSection', () => ({
  ContactLinksSection: (props: Record<string, any>) => {
    mocks.contactProps = props;
    return <div>contact-links</div>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: (props: Record<string, any>) => {
    mocks.hashtagProps = props;
    return <div>hashtag-editor</div>;
  },
}));
vi.mock('../MembershipStatusTable', () => ({
  MembershipStatusTable: (props: Record<string, any>) => {
    mocks.membershipTables.push(props);
    return <div>{`${props.entityKey}-${props.statusType}`}</div>;
  },
}));
vi.mock('../AccountPasswordSectionView', () => ({
  AccountPasswordSectionView: (props: Record<string, any>) => {
    mocks.passwordViewProps = props;
    return <div>password-view</div>;
  },
}));
vi.mock('../CurrentPasswordConfirmationDialog', () => ({
  CurrentPasswordConfirmationDialog: (props: Record<string, any>) => {
    mocks.confirmationProps = props;
    return <div>confirmation-view</div>;
  },
}));
vi.mock('@/features/shared/ui/rich-text/RichTextPreview', () => ({
  RichTextPreview: ({ content }: { content: unknown }) => <div>{JSON.stringify(content)}</div>,
}));
vi.mock('../WikiAvatar', () => ({
  WikiAvatar: ({ name, avatar }: { name: string; avatar: string }) => (
    <div>{`${name}:${avatar}`}</div>
  ),
}));

import { AboutSection } from '../AboutSection';
import { AccountPasswordSectionShellView } from '../AccountPasswordSectionShellView';
import { AmendmentCollaborationsTab } from '../AmendmentCollaborationsTab';
import { BasicInformationSection } from '../BasicInformationSection';
import { ContactInformationSection } from '../ContactInformationSection';
import { EventParticipationsTab } from '../EventParticipationsTab';
import { GroupMembershipsTab } from '../GroupMembershipsTab';
import { HashtagsSection } from '../HashtagsSection';
import { UserAbout } from '../UserAbout';
import { UserWikiHeader } from '../UserWikiHeader';

beforeEach(() => {
  mocks.editors = [];
  mocks.inputs = [];
  mocks.selects = [];
  mocks.membershipTables = [];
  mocks.contactProps = undefined;
  mocks.hashtagProps = undefined;
  mocks.passwordViewProps = undefined;
  mocks.confirmationProps = undefined;
  mocks.validationCalls = [];
});

afterEach(cleanup);

const memberships = {
  invited: [{ id: 'invited' }],
  active: [{ id: 'active' }],
  requested: [{ id: 'requested' }],
};

const membershipActions = {
  onAcceptInvitation: vi.fn(),
  onDeclineInvitation: vi.fn(),
  onLeave: vi.fn(),
  onWithdrawRequest: vi.fn(),
  userId: 'user-1',
  searchQuery: 'climate',
};

describe('A07 user section execution contracts', () => {
  it('renders about, hashtags, password shell, preview, and wiki header', () => {
    const onAbout = vi.fn();
    const onHashtags = vi.fn();
    render(
      <>
        <AboutSection
          aboutContent={[{ type: 'p', children: [] }] as never}
          onAboutContentChange={onAbout}
        />
        <HashtagsSection hashtags={['democracy']} onHashtagsChange={onHashtags} />
        <AccountPasswordSectionShellView
          accountPasswordProps={{ value: 'password' } as never}
          confirmationDialogProps={{ open: true } as never}
          requiresInitialPassword
        />
        <UserAbout about={{ text: 'About Ada' }} />
        <UserWikiHeader name="Ada" avatar="avatar.png" subtitle="Organizer" />
      </>
    );

    expect(mocks.editors[0]).toMatchObject({ id: 'about', onChange: onAbout });
    expect(mocks.hashtagProps).toMatchObject({ value: ['democracy'], onChange: onHashtags });
    expect(mocks.passwordViewProps).toEqual({ value: 'password' });
    expect(mocks.confirmationProps).toEqual({ open: true });
    expect(screen.getByText('{"text":"About Ada"}')).toBeTruthy();
    expect(screen.getByText('Ada:avatar.png')).toBeTruthy();
    expect(screen.getByText('Organizer')).toBeTruthy();
  });

  it('forwards all amendment, event, and group membership status contracts', () => {
    render(
      <>
        <AmendmentCollaborationsTab
          collaborationsByStatus={memberships as never}
          {...membershipActions}
        />
        <EventParticipationsTab
          participationsByStatus={memberships as never}
          {...membershipActions}
        />
        <GroupMembershipsTab membershipsByStatus={memberships as never} {...membershipActions} />
      </>
    );

    expect(mocks.membershipTables).toHaveLength(9);
    expect(mocks.membershipTables.map(table => `${table.entityKey}:${table.statusType}`)).toEqual([
      'amendment:invited',
      'amendment:active',
      'amendment:requested',
      'event:invited',
      'event:active',
      'event:requested',
      'group:invited',
      'group:active',
      'group:requested',
    ]);
    const groupInvitation = mocks.membershipTables[6];
    expect(groupInvitation.getAcceptPreflightInput({ id: 'membership-1' })).toEqual({
      kind: 'membership_activation',
      membership_id: 'membership-1',
    });
  });

  it('wires basic-information changes and executes every inline validator', () => {
    const onGenderChange = vi.fn();
    render(
      <BasicInformationSection
        firstName="Ada"
        lastName="Lovelace"
        gender="female"
        subtitle="Organizer"
        onFirstNameChange={vi.fn()}
        onLastNameChange={vi.fn()}
        onGenderChange={onGenderChange}
        onSubtitleChange={vi.fn()}
      />
    );

    for (const input of mocks.inputs) expect(input.validator(input.value)).toBe(true);
    mocks.selects[0].onValueChange('diverse');
    expect(onGenderChange).toHaveBeenCalledWith('diverse');
    expect(mocks.validationCalls).toEqual(
      expect.arrayContaining([
        ['hasMinLength', 'Ada', 2],
        ['isOptionalMinLength', 'Lovelace', 2],
        ['isOptionalMinLength', 'Organizer', 3],
      ])
    );
  });

  it('wires contact changes and executes all eight social validators', () => {
    const values = {
      email: 'ada@example.org',
      website: 'https://example.org',
      youtube: 'youtube',
      linkedin: 'linkedin',
      whatsapp: 'whatsapp',
      instagram: 'instagram',
      twitter: 'twitter',
      facebook: 'facebook',
      snapchat: 'snapchat',
      tiktok: 'tiktok',
    };
    render(
      <ContactInformationSection
        {...values}
        onEmailChange={vi.fn()}
        onWebsiteChange={vi.fn()}
        onYoutubeChange={vi.fn()}
        onLinkedinChange={vi.fn()}
        onWhatsappChange={vi.fn()}
        onInstagramChange={vi.fn()}
        onTwitterChange={vi.fn()}
        onFacebookChange={vi.fn()}
        onSnapchatChange={vi.fn()}
        onTiktokChange={vi.fn()}
      />
    );

    for (const field of [
      ...mocks.contactProps!.primaryFields,
      ...mocks.contactProps!.socialFields,
    ]) {
      expect(field.validator(field.value)).toBe(true);
    }
    expect(mocks.validationCalls.filter(call => call[0] === 'social')).toHaveLength(8);
  });
});
