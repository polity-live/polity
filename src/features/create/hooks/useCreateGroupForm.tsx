import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { DateTimeRangeInput } from '../ui/inputs/DateTimeRangeInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField } from '../ui/CreateFields';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { useUserState } from '@/zero/users/useUserState';
import { useAuth } from '@/providers/auth-provider';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import {
  getCurrentGroupRelationshipLabel,
  getGroupRelationshipRightLabel,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
  invertGroupRelationshipType,
  type GroupRelationshipRight,
  type GroupRelationshipType,
} from '@/features/network/ui/GroupRelationshipFields';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Switch } from '@/features/shared/ui/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { isValidOptionalEmailAddress } from '@/features/shared/logic/inputValidation';
import { cn } from '@/features/shared/utils/utils.ts';
import { matchInviteCsvUsers, type InviteCsvMatchResult } from '../logic/groupInviteCsv';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { X, Upload, Link2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { CreateFormConfig } from '../types/create-form.types';
import { CreateTypeaheadField } from '../ui/CreateFields';

type GroupType = 'base' | 'hierarchical';

interface LinkedGroup {
  groupId: string;
  groupName: string;
  type: GroupRelationshipType;
  rights: GroupRelationshipRight[];
}

interface CsvInviteSummary extends InviteCsvMatchResult {
  matchedNames: string[];
}

function getRelationshipBadgeClasses(type: LinkedGroup['type']) {
  return type === 'parent'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'border-sky-300 bg-sky-50 text-sky-800';
}

function getRightBadgeClasses(right: string) {
  switch (right) {
    case 'informationRight':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'amendmentRight':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'rightToSpeak':
      return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800';
    case 'activeVotingRight':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'passiveVotingRight':
      return 'border-violet-200 bg-violet-50 text-violet-800';
    default:
      return 'border-muted bg-muted/50 text-foreground';
  }
}

export function useCreateGroupForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createGroup, inviteMember, createRelationship } = useGroupActions();
  const { createEvent } = useEventActions();
  const commonActions = useCommonActions();
  const { groups: allGroups } = useAllGroups();
  const { allUsers } = useUserState({ includeAllUsers: true });

  const [groupId] = useState(() => crypto.randomUUID());
  const [groupType, setGroupType] = useState<GroupType>('base');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionContent, setDescriptionContent] = useState<Value>(EMPTY_RICH_TEXT_VALUE);
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [post_code, setPostCode] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house_number, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [imageURL, setImageURL] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite members state
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [csvInviteSummary, setCsvInviteSummary] = useState<CsvInviteSummary | null>(null);

  // Link groups state
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>([]);
  const [linkGroupId, setLinkGroupId] = useState('');
  const [linkType, setLinkType] = useState<GroupRelationshipType>('parent');
  const [linkRights, setLinkRights] = useState<Set<GroupRelationshipRight>>(new Set());

  // Constitutional event state
  const [createConstitutionalEvent, setCreateConstitutionalEvent] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');

  const { allHashtags } = useCommonState({ loadAllHashtags: true });
  const emailValidationMessage = t('common.validation.emailHint', 'Enter a valid email address.');
  const emailIsValid = isValidOptionalEmailAddress(email);

  useEffect(() => {
    if (groupType === 'base' && linkType !== 'child') {
      setLinkType('child');
    }
  }, [groupType, linkType]);

  const handleDescriptionContentChange = useCallback((value: Value) => {
    setDescriptionContent(value);
    setDescription(richTextToPlainText(value));
  }, []);

  const handleCsvUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = evt => {
        const text = evt.target?.result as string;
        if (!text) return;

        const result = matchInviteCsvUsers(text, allUsers, { excludeUserId: user?.id });

        if (result.missingColumns) {
          setCsvInviteSummary(null);
          toast.error(t('pages.create.group.csvMissingColumns'));
          return;
        }

        if (
          result.matchedUsers.length === 0 &&
          result.notFoundNames.length === 0 &&
          result.ambiguousNames.length === 0 &&
          result.invalidRows.length === 0
        ) {
          setCsvInviteSummary(null);
          toast.error(t('pages.create.group.csvEmpty'));
          return;
        }

        if (result.matchedUsers.length > 0) {
          setInvitedUserIds(prev => {
            const next = new Set(prev);
            for (const matchedUser of result.matchedUsers) {
              next.add(matchedUser.id);
            }
            return [...next];
          });
        }

        const matchedNames = result.matchedUsers.map(userEntry => userEntry.name);
        setCsvInviteSummary({
          ...result,
          matchedNames,
        });

        if (result.matchedUsers.length > 0) {
          toast.success(
            t('pages.create.group.csvMatchedUsers', { count: result.matchedUsers.length })
          );
        }

        if (
          result.notFoundNames.length > 0 ||
          result.ambiguousNames.length > 0 ||
          result.invalidRows.length > 0
        ) {
          toast.info(t('pages.create.group.csvReviewSummary'));
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be re-uploaded
      e.target.value = '';
    },
    [allUsers, t, user?.id]
  );

  const handleAddLinkedGroup = useCallback(() => {
    if (!linkGroupId || linkRights.size === 0) {
      toast.error(t('pages.create.group.selectGroupAndRights'));
      return;
    }
    const existing = linkedGroups.find(g => g.groupId === linkGroupId);
    if (existing) {
      toast.info(t('pages.create.group.groupAlreadyLinked'));
      setLinkedGroups(prev =>
        prev.map(g =>
          g.groupId === linkGroupId ? { ...g, type: linkType, rights: [...linkRights] } : g
        )
      );
    } else {
      const group = allGroups.find(g => g.id === linkGroupId);
      setLinkedGroups(prev => [
        ...prev,
        {
          groupId: linkGroupId,
          groupName: group?.name ?? linkGroupId,
          type: linkType,
          rights: [...linkRights],
        },
      ]);
    }
    setLinkGroupId('');
    setLinkRights(new Set());
  }, [linkGroupId, linkType, linkRights, linkedGroups, allGroups, t]);

  const handleRemoveLinkedGroup = useCallback((gId: string) => {
    setLinkedGroups(prev => prev.filter(g => g.groupId !== gId));
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !emailIsValid) {
      if (!emailIsValid) {
        toast.error(emailValidationMessage);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const createGroupResult = createGroup({
        id: groupId,
        name: name.trim(),
        description: description ? toZeroRichTextValue(descriptionContent) : null,
        email: email || null,
        country: country || null,
        region: region || null,
        post_code: post_code || null,
        city: city || null,
        street: street || null,
        house_number: house_number || null,
        latitude,
        longitude,
        image_url: imageURL || null,
        x: null,
        youtube: null,
        linkedin: null,
        website: null,
        whatsapp: null,
        instagram: null,
        twitter: null,
        facebook: null,
        snapchat: null,
        tiktok: null,
        visibility,
        group_type: groupType,
        owner_id: null,
      });
      await serverConfirmed(createGroupResult);
      if (hashtags.length > 0) {
        await commonActions.syncEntityHashtags('group', groupId, hashtags, [], allHashtags ?? []);
      }

      // Invite members
      for (const userId of invitedUserIds) {
        await inviteMember({
          id: crypto.randomUUID(),
          user_id: userId,
          group_id: groupId,
          role_id: null,
          visibility: '',
          status: 'invited',
        });
      }

      // Create group relationships
      for (const link of linkedGroups) {
        const isParent = link.type === 'parent';
        for (const right of link.rights) {
          await createRelationship({
            id: crypto.randomUUID(),
            group_id: isParent ? groupId : link.groupId,
            related_group_id: isParent ? link.groupId : groupId,
            relationship_type: invertGroupRelationshipType(link.type),
            with_right: right,
            status: 'requested',
            initiator_group_id: groupId,
          });
        }
      }

      // Create constitutional event
      if (createConstitutionalEvent && eventName.trim() && user?.id) {
        const startTimestamp = eventStartDate
          ? new Date(`${eventStartDate}T${eventStartTime || '00:00'}`).getTime()
          : null;
        await createEvent({
          id: crypto.randomUUID(),
          title: eventName.trim(),
          event_type: 'general_assembly',
          group_id: groupId,
          creator_id: user.id,
          visibility,
          location_name: eventLocation || null,
          start_date: startTimestamp,
          invited_user_ids: invitedUserIds,
        });
      }

      navigate({ to: `/group/${groupId}` });
    } catch {
      setIsSubmitting(false);
    }
  };

  const locationSummary = formatLocation({
    country,
    region,
    post_code,
    city,
    street,
    house_number,
  });

  const selectedLinkedGroupName = allGroups.find(group => group.id === linkGroupId)?.name ?? '';

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'group',
      title: 'pages.create.group.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.group.basicInfo'),
          isValid: () => !!name.trim() && emailIsValid,
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.group.nameLabel')}
                required
                hint={t('pages.create.group.tips.name')}
                value={name}
                onValueChange={setName}
                placeholder={t('pages.create.group.namePlaceholder')}
              />
              <div className="space-y-2">
                <Label>{t('pages.create.group.descriptionLabel')}</Label>
                <p className="text-muted-foreground text-xs">
                  {t('pages.create.group.tips.description')}
                </p>
                <MiniPlateEditor
                  value={descriptionContent}
                  onChange={handleDescriptionContentChange}
                  placeholder={t('pages.create.group.descriptionPlaceholder')}
                />
              </div>
              <CreateInputField
                label={t('pages.create.group.emailLabel')}
                type="email"
                validator={value =>
                  isValidOptionalEmailAddress(value) ? null : emailValidationMessage
                }
                value={email}
                onValueChange={setEmail}
                placeholder={t('pages.create.group.emailPlaceholder')}
              />
              <div className="space-y-2">
                <Label>{t('pages.create.group.groupType')}</Label>
                <RadioGroup value={groupType} onValueChange={v => setGroupType(v as GroupType)}>
                  <div className="space-y-2">
                    <Label
                      htmlFor="group-type-base"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        groupType === 'base' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="base" id="group-type-base" className="mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">
                          {t('pages.create.group.groupTypes.base')}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('pages.create.group.groupTypes.baseDesc')}
                        </div>
                      </div>
                    </Label>
                    <Label
                      htmlFor="group-type-hierarchical"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        groupType === 'hierarchical'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem
                        value="hierarchical"
                        id="group-type-hierarchical"
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {t('pages.create.group.groupTypes.hierarchical')}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('pages.create.group.groupTypes.hierarchicalDesc')}
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          ),
        },
        {
          label: t('pages.create.group.locationLabel'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.group.tips.location')}
              </p>
              <GeoAddressPicker
                idPrefix="create-group-location"
                values={{
                  country,
                  region,
                  city,
                  post_code,
                  street,
                  house_number,
                }}
                coordinates={
                  latitude !== null && longitude !== null ? { latitude, longitude } : null
                }
                onCoordinatesChange={coordinates => {
                  setLatitude(coordinates?.latitude ?? null);
                  setLongitude(coordinates?.longitude ?? null);
                }}
                onFieldChange={(field, value) => {
                  switch (field) {
                    case 'country':
                      setCountry(value);
                      break;
                    case 'region':
                      setRegion(value);
                      break;
                    case 'city':
                      setCity(value);
                      break;
                    case 'post_code':
                      setPostCode(value);
                      break;
                    case 'street':
                      setStreet(value);
                      break;
                    case 'house_number':
                      setHouseNumber(value);
                      break;
                  }
                }}
                labels={{
                  country: t('pages.create.group.countryLabel'),
                  region: t('pages.create.group.regionLabel'),
                  city: t('pages.create.event.city'),
                  post_code: t('pages.create.event.postalCode'),
                  street: t('pages.create.event.street'),
                  house_number: t('pages.create.event.houseNumber'),
                }}
                placeholders={{
                  country: t('pages.create.group.countryPlaceholder'),
                  region: t('pages.create.group.regionPlaceholder'),
                  city: t('pages.create.event.city'),
                  post_code: t('pages.create.event.postalCode'),
                  street: t('pages.create.event.street'),
                  house_number: t('pages.create.event.houseNumber'),
                }}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.group.imageAndTags'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <ImageUpload
                currentImage={imageURL}
                onImageChange={(url: string) => setImageURL(url)}
                cleanupOnRemove
                entityType="groups"
                entityId={groupId}
                label={t('pages.create.group.imageLabel')}
                description={t('pages.create.group.imageDescription')}
              />
              <VisibilityInput value={visibility} onChange={setVisibility} />
              <HashtagEditor
                value={hashtags}
                onChange={setHashtags}
                placeholder={t('pages.create.group.hashtagPlaceholder')}
              />
            </div>
          ),
        },
        // Step 4: Invite Members
        {
          label: t('pages.create.group.inviteMembers'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.group.tips.inviteMembers')}
              </p>
              <UserSearchInput
                value={invitedUserIds}
                onChange={setInvitedUserIds}
                label={t('pages.create.group.searchUsers')}
                placeholder={t('pages.create.group.searchUsers')}
                excludeUserId={user?.id}
                multi
              />
              <Card className="bg-muted/20 border-dashed shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    {t('pages.create.group.csvGuideTitle')}
                  </CardTitle>
                  <CardDescription>{t('pages.create.group.csvGuideDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="csv-format" className="border-none">
                      <AccordionTrigger className="hover:bg-muted/50 rounded-md px-3 py-2 text-sm hover:no-underline">
                        {t('pages.create.group.csvGuideTrigger')}
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 px-1 pt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('pages.create.group.csvColumnFirstName')}</TableHead>
                              <TableHead>{t('pages.create.group.csvColumnLastName')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Ada</TableCell>
                              <TableCell>Lovelace</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Grace</TableCell>
                              <TableCell>Hopper</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <p className="text-muted-foreground text-xs">
                          {t('pages.create.group.csvGuideFootnote')}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="csv-upload"
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {t('pages.create.group.inviteMembersOptional')} (CSV)
                </Label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
              </div>
              {csvInviteSummary && (
                <Card className="border-muted bg-background shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {t('pages.create.group.csvSummaryTitle')}
                    </CardTitle>
                    <CardDescription>
                      {t('pages.create.group.csvSummaryDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                        {t('pages.create.group.csvFoundCount', {
                          count: csvInviteSummary.matchedNames.length,
                        })}
                      </Badge>
                      <Badge className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50">
                        {t('pages.create.group.csvNotFoundCount', {
                          count: csvInviteSummary.notFoundNames.length,
                        })}
                      </Badge>
                      {csvInviteSummary.ambiguousNames.length > 0 && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                          {t('pages.create.group.csvAmbiguousCount', {
                            count: csvInviteSummary.ambiguousNames.length,
                          })}
                        </Badge>
                      )}
                    </div>

                    {csvInviteSummary.matchedNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-emerald-700 uppercase">
                          {t('pages.create.group.csvFoundNames')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.matchedNames.map(name => (
                            <Badge
                              key={name}
                              className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvInviteSummary.notFoundNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-rose-700 uppercase">
                          {t('pages.create.group.csvNotFoundNames')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.notFoundNames.map(name => (
                            <Badge
                              key={name}
                              className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvInviteSummary.ambiguousNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-amber-700 uppercase">
                          {t('pages.create.group.csvAmbiguousNames')}
                        </Label>
                        <div className="space-y-2">
                          {csvInviteSummary.ambiguousNames.map(entry => (
                            <div
                              key={entry.fullName}
                              className="rounded-md border border-amber-200 bg-amber-50/60 p-3"
                            >
                              <div className="text-sm font-medium text-amber-900">
                                {entry.fullName}
                              </div>
                              <div className="text-xs text-amber-800">
                                {t('pages.create.group.csvAmbiguousCandidates', {
                                  candidates: entry.candidates
                                    .map(candidate => candidate.name)
                                    .join(', '),
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvInviteSummary.invalidRows.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-amber-700 uppercase">
                          {t('pages.create.group.csvInvalidRows')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.invalidRows.map(row => (
                            <Badge
                              key={row}
                              className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
                            >
                              {row}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {invitedUserIds.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {invitedUserIds.length} {t('pages.create.group.invited')}
                </p>
              )}
            </div>
          ),
        },
        // Step 5: Link Groups
        {
          label: t('pages.create.group.linkGroups'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.group.tips.linkGroups')}
              </p>
              <CreateTypeaheadField
                label={t('pages.create.group.selectGroup')}
                items={toTypeaheadItems(
                  allGroups.filter(g => g.id !== groupId),
                  'group',
                  g => g.name || 'Group',
                  g =>
                    typeof g.description === 'string' ? g.description.substring(0, 60) : undefined
                )}
                value={linkGroupId || undefined}
                onChange={item => setLinkGroupId(item?.id ?? '')}
                placeholder={t('pages.create.group.searchGroups')}
              />
              {linkGroupId ? (
                <>
                  <GroupRelationshipTypeSelect
                    id="create-group-relationship-type"
                    label={t('pages.create.group.relationshipType')}
                    value={linkType}
                    currentGroupName={name}
                    selectedGroupName={selectedLinkedGroupName}
                    onValueChange={setLinkType}
                    disabledOptions={{ parent: groupType === 'base' }}
                    helperText={
                      groupType === 'base'
                        ? t('common.network.baseGroupsCanOnlyBeChildren')
                        : undefined
                    }
                  />
                  <GroupRelationshipRightsSelector
                    label={t('pages.create.group.selectRights')}
                    selectedRights={linkRights}
                    onToggleRight={right => {
                      setLinkRights(prev => {
                        const next = new Set(prev);
                        if (next.has(right)) {
                          next.delete(right);
                        } else {
                          next.add(right);
                        }
                        return next;
                      });
                    }}
                  />
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLinkedGroup}
                disabled={!linkGroupId || linkRights.size === 0}
              >
                <Link2 className="mr-1 h-4 w-4" />
                {t('pages.create.group.addGroupLink')}
              </Button>
              {linkedGroups.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    {t('pages.create.group.linkedGroups')}
                  </Label>
                  {linkedGroups.map(lg => (
                    <div key={lg.groupId} className="flex items-start gap-3 rounded-md border p-3">
                      <Badge
                        className={cn(
                          'border text-xs hover:opacity-100',
                          getRelationshipBadgeClasses(lg.type)
                        )}
                      >
                        {lg.type === 'parent'
                          ? t('pages.create.group.parent')
                          : t('pages.create.group.child')}
                      </Badge>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <span className="block text-sm font-medium">{lg.groupName}</span>
                          <p className="text-muted-foreground text-xs">
                            {getCurrentGroupRelationshipLabel({
                              relationshipType: lg.type,
                              currentGroupName: name,
                              selectedGroupName: lg.groupName,
                              t,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lg.rights.map(right => (
                            <Badge
                              key={right}
                              className={cn(
                                'border text-xs hover:opacity-100',
                                getRightBadgeClasses(right)
                              )}
                            >
                              {getGroupRelationshipRightLabel(right, t)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveLinkedGroup(lg.groupId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        },
        // Step 6: Constitutional Event
        {
          label: t('pages.create.group.createConstitutionalEvent'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.group.tips.constitutionalEvent')}
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={createConstitutionalEvent}
                  onCheckedChange={setCreateConstitutionalEvent}
                />
                <Label>{t('pages.create.group.optionalGeneralAssembly')}</Label>
              </div>
              {createConstitutionalEvent && (
                <div className="space-y-4 rounded-md border p-4">
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.group.eventTypeDescription')}
                  </p>
                  <CreateInputField
                    label={t('pages.create.group.eventName')}
                    value={eventName}
                    onValueChange={setEventName}
                    placeholder={t('pages.create.group.eventNamePlaceholder')}
                  />
                  <CreateInputField
                    label={t('pages.create.group.eventLocation')}
                    value={eventLocation}
                    onValueChange={setEventLocation}
                    placeholder={t('pages.create.group.eventLocationPlaceholder')}
                  />
                  <DateTimeRangeInput
                    startDate={eventStartDate}
                    startTime={eventStartTime}
                    showEnd={false}
                    onChange={(field, value) => {
                      if (field === 'startDate') setEventStartDate(value);
                      else if (field === 'startTime') setEventStartTime(value);
                    }}
                  />
                </div>
              )}
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!name.trim() && emailIsValid,
          content: (
            <CreateSummaryStep
              entityType="group"
              badge={t('pages.create.group.reviewBadge')}
              title={name || t('pages.create.group.namePlaceholder')}
              subtitle={description || undefined}
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              fields={[
                {
                  ...(email ? [{ label: t('pages.create.group.emailLabel'), value: email }] : []),
                },
                {
                  label: t('pages.create.group.groupType'),
                  value:
                    groupType === 'base'
                      ? t('pages.create.group.groupTypes.base')
                      : t('pages.create.group.groupTypes.hierarchical'),
                },
                ...(locationSummary
                  ? [{ label: t('pages.create.group.locationLabel'), value: locationSummary }]
                  : []),
                { label: t('pages.create.common.visibility'), value: visibility },
                ...(invitedUserIds.length > 0
                  ? [
                      {
                        label: t('pages.create.group.invitedMembersLabel'),
                        value: `${invitedUserIds.length} ${t('pages.create.group.invited')}`,
                      },
                    ]
                  : []),
                ...(linkedGroups.length > 0
                  ? [
                      {
                        label: t('pages.create.group.groupLinksLabel'),
                        value: linkedGroups
                          .map(g =>
                            getCurrentGroupRelationshipLabel({
                              relationshipType: g.type,
                              currentGroupName: name,
                              selectedGroupName: g.groupName,
                              t,
                            })
                          )
                          .join(', '),
                      },
                    ]
                  : []),
                ...(createConstitutionalEvent && eventName
                  ? [{ label: t('pages.create.group.constitutionalEventLabel'), value: eventName }]
                  : []),
              ]}
            />
          ),
        },
      ],
    }),
    [
      name,
      description,
      descriptionContent,
      email,
      country,
      region,
      post_code,
      city,
      street,
      house_number,
      imageURL,
      hashtags,
      visibility,
      groupType,
      isSubmitting,
      groupId,
      t,
      invitedUserIds,
      linkedGroups,
      linkGroupId,
      linkType,
      linkRights,
      allGroups,
      createConstitutionalEvent,
      eventName,
      eventLocation,
      eventStartDate,
      eventStartTime,
      handleDescriptionContentChange,
      emailIsValid,
      emailValidationMessage,
      user,
    ]
  );

  return config;
}
