/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  contactProps: undefined as any,
  mediaProps: undefined as any,
  basicProps: undefined as any,
  visibilityProps: undefined as any,
  hashtagProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/contact/ContactLinksSection', () => ({
  ContactLinksSection: (props: any) => {
    mocks.contactProps = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
  FormControlSelect: ({ children, onValueChange }: any) => {
    onValueChange?.('selected');
    return <div>{children}</div>;
  },
  FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
  FormControlSelectItem: ({ children }: any) => <div>{children}</div>,
  FormControlSelectTrigger: ({ children }: any) => <div>{children}</div>,
  FormControlSelectValue: () => <span />,
  SettingsActionBar: ({ children }: any) => <div>{children}</div>,
  SettingsTabs: ({ children }: any) => <div>{children}</div>,
  CreateReviewCard: ({ children }: any) => <div>{children}</div>,
  SummaryField: () => <div />,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: (props: any) => {
    mocks.mediaProps = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: (props: any) => {
    mocks.hashtagProps = props;
    return <div />;
  },
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: (props: any) => {
    mocks.visibilityProps = props;
    return <div />;
  },
}));
vi.mock('../BasicInfoSection', () => ({
  BasicInfoSection: (props: any) => {
    mocks.basicProps = props;
    return <div />;
  },
}));
vi.mock('../GroupTypeSection', () => ({ GroupTypeSection: () => <div /> }));
vi.mock('../LocationInfoSection', () => ({ LocationInfoSection: () => <div /> }));
vi.mock('../GroupThemeSettings', () => ({ GroupThemeSettings: () => <div /> }));
vi.mock('../GroupConflictPanel', () => ({
  GroupConflictDialog: () => <div />,
  GroupConflictPanel: () => <div />,
}));

import { GroupEditFormView } from '../GroupEditFormView';
import { SocialMediaSection } from '../SocialMediaSection';

const formData = {
  name: 'Group',
  description: 'Description',
  descriptionContent: [],
  hashtags: [],
  imageURL: '',
  videoURL: '',
  visibility: 'public',
  connected_group_id: '',
  siblingMembershipDirection: '',
  sibling_membership_mode: 'role_members',
  sibling_role_id: '',
  connectedRelationshipDirections: {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  },
  email: '',
  website: '',
  whatsapp: '',
  instagram: '',
  twitter: '',
  facebook: '',
  snapchat: '',
  tiktok: '',
  youtube: '',
  linkedin: '',
};

const baseProps = {
  groupId: 'group',
  initialData: {},
  onCancel: vi.fn(),
  actorId: 'user',
  visibility: 'public',
  groupType: 'base',
  hasHierarchyChildren: false,
  hasSiblingConnections: false,
  showSiblingRelationshipEditor: true,
  activeTab: 'general',
  onTabChange: vi.fn(),
  t: (key: string) => key,
  isCreating: false,
  showReview: false,
  setShowReview: vi.fn(),
  formRef: { current: null },
  formData,
  setFormData: vi.fn(),
  updateDescriptionContent: vi.fn(),
  updateField: vi.fn(),
  removeImage: vi.fn(),
  handleSubmit: vi.fn(),
  isSubmitting: false,
  allGroups: [],
  connectedGroupRoles: [],
  groupConnections: [],
  selectableConnectedGroups: [{ id: 'partner', name: 'Partner' }],
  selectableConnectedRoles: [{ id: 'role', name: 'Role' }],
  relationshipDirectionOptions: [{ value: 'none', label: 'None' }],
  membershipDirectionOptions: [
    { value: 'current_members_to_partner', label: 'Forward', description: 'Forward' },
  ],
  existingSiblingLink: null,
  siblingGrants: [],
  siblingMembershipRule: null,
  pair: null,
  hasSiblingMembership: false,
  siblingConfigurationPreflight: { isLoading: false, blocking: false, response: {} },
  onFormSubmit: vi.fn(),
  confirmCreate: vi.fn(),
} as any;

it('executes every social contact change and validator callback', () => {
  const onChange = vi.fn();
  render(<SocialMediaSection formData={formData as never} onChange={onChange} />);
  const fields = [...mocks.contactProps.primaryFields, ...mocks.contactProps.socialFields];
  fields.forEach((field: any) => {
    field.onChange('value');
    field.validator?.('value');
  });
  expect(onChange).toHaveBeenCalledTimes(10);
});

it('executes general group-edit field callbacks', () => {
  const updateField = vi.fn();
  const setFormData = vi.fn();
  render(<GroupEditFormView {...baseProps} updateField={updateField} setFormData={setFormData} />);
  mocks.mediaProps.onImageChange('image');
  mocks.mediaProps.onVideoChange('video');
  mocks.basicProps.onNameChange('Name');
  mocks.visibilityProps.onChange('private');
  mocks.hashtagProps.onChange(['tag']);
  expect(updateField).toHaveBeenCalledWith('imageURL', 'image');
  expect(updateField).toHaveBeenCalledWith('videoURL', 'video');
  expect(updateField).toHaveBeenCalledWith('name', 'Name');
  expect(updateField).toHaveBeenCalledWith('visibility', 'private');
  expect(setFormData).toHaveBeenCalled();
});

it('executes every relationship select callback', () => {
  const updateField = vi.fn();
  render(<GroupEditFormView {...baseProps} activeTab="relationships" updateField={updateField} />);
  expect(updateField).toHaveBeenCalledWith('connected_group_id', 'selected');
  expect(updateField).toHaveBeenCalledWith('siblingMembershipDirection', 'selected');
  expect(updateField).toHaveBeenCalledWith('sibling_membership_mode', 'selected');
  expect(updateField).toHaveBeenCalledWith('sibling_role_id', 'selected');
  expect(updateField).toHaveBeenCalledWith('connectedRelationshipDirections', expect.any(Object));
});
