import type { SearchContentItem } from '@/features/search/types/search.types';
import { getMembershipRoleNames } from '@/features/shared/logic/membershipRoleHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import type { UserProfile } from '../types/user.types';
import { buildSearchText } from './userWikiSearch';

export type UserWikiContentItem = SearchContentItem & {
  searchText: string;
};

interface BuildUserWikiContentItemsOptions {
  user: UserProfile;
  authorName: string;
  authorAvatar: string;
}

function toDate(value: string | number | Date | null | undefined): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value == null) {
    return new Date(0);
  }

  return new Date(value);
}

export function buildUserWikiContentItems({
  user,
  authorName,
  authorAvatar,
}: BuildUserWikiContentItemsOptions): UserWikiContentItem[] {
  const items: UserWikiContentItem[] = [];

  const seenAmendmentIds = new Set<string>();
  for (const collaboration of user.amendment_collaborations ?? []) {
    const amendment = collaboration.amendment;
    if (!amendment || seenAmendmentIds.has(amendment.id)) {
      continue;
    }

    seenAmendmentIds.add(amendment.id);

    const hashtagTags = extractHashtagTags(amendment.amendment_hashtags);
    const rawTags = Array.isArray(amendment.tags)
      ? amendment.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    const tags = hashtagTags.length > 0 ? hashtagTags : rawTags;
    const description = richTextToPlainText(amendment.reason ?? amendment.preamble);

    items.push({
      id: amendment.id,
      type: 'amendment',
      title: amendment.title ?? '',
      description: description || undefined,
      createdAt: toDate(amendment.created_at),
      tags,
      groupId: amendment.group?.id,
      groupName: amendment.group?.name,
      status: amendment.editing_mode,
      collaboratorCount: amendment.collaborators?.length,
      changeRequestCount: amendment.change_requests?.length,
      commentCount: amendment.comment_count,
      stats: {
        reactions: amendment.vote_entries?.length,
        comments: amendment.comment_count,
      },
      searchText: buildSearchText(
        amendment.title,
        amendment.reason,
        amendment.preamble,
        amendment.editing_mode,
        amendment.code,
        amendment.created_at,
        amendment.group?.name,
        tags
      ),
    });
  }

  const seenBlogIds = new Set<string>();
  for (const relation of user.blogger_relations ?? []) {
    const blog = relation.blog;
    if (!blog || seenBlogIds.has(blog.id)) {
      continue;
    }

    seenBlogIds.add(blog.id);
    const tags = extractHashtagTags(blog.blog_hashtags);
    const description = richTextToPlainText(blog.description);

    items.push({
      id: blog.id,
      type: 'blog',
      title: blog.title ?? '',
      description: description || undefined,
      imageUrl: blog.image_url,
      createdAt: toDate(blog.created_at),
      tags,
      authorId: user.id,
      authorName,
      authorAvatar,
      groupId: blog.group_id ?? undefined,
      commentCount: blog.comment_count,
      stats: {
        comments: blog.comment_count,
      },
      searchText: buildSearchText(blog.title, blog.description, blog.date, tags),
    });
  }

  const seenGroupIds = new Set<string>();
  for (const membership of user.group_memberships ?? []) {
    const group = membership.group;
    if (!group || seenGroupIds.has(group.id)) {
      continue;
    }

    seenGroupIds.add(group.id);
    const tags = extractHashtagTags(group.group_hashtags);
    const description = richTextToPlainText(group.description);
    const membershipRoleNames = getMembershipRoleNames(membership).join(' ');

    items.push({
      id: group.id,
      type: 'group',
      title: group.name ?? '',
      description: description || undefined,
      createdAt: toDate(group.created_at),
      tags,
      groupId: group.id,
      groupName: group.name,
      memberCount: group.member_count ?? undefined,
      eventCount: group.event_count ?? group.events?.length,
      amendmentCount: group.amendment_count ?? group.amendments?.length,
      stats: {
        members: group.member_count ?? undefined,
      },
      searchText: buildSearchText(group.name, group.description, membershipRoleNames, tags),
    });
  }

  for (const statement of user.statements ?? []) {
    const tags = extractHashtagTags(statement.statement_hashtags);
    const text = richTextToPlainText(statement.text);
    const supportVotes = statement.support_votes ?? [];
    const survey = statement.surveys?.[0];

    items.push({
      id: statement.id,
      type: 'statement',
      title: text,
      description: text,
      imageUrl: statement.image_url,
      videoUrl: statement.video_url,
      createdAt: toDate(statement.created_at),
      tags,
      authorId: user.id,
      authorName,
      authorAvatar,
      groupId: statement.group_id ?? undefined,
      groupName: statement.group?.name,
      groupImageUrl: statement.group?.image_url,
      commentCount: statement.comment_count,
      upvotes: supportVotes.filter(vote => vote.vote === 1).length,
      downvotes: supportVotes.filter(vote => vote.vote === -1).length,
      surveyQuestion: survey?.question ?? undefined,
      surveyOptions: survey?.options?.map(option => ({
        label: option.label,
        voteCount: option.votes?.length ?? 0,
      })),
      stats: {
        reactions: supportVotes.length,
        comments: statement.comment_count,
      },
      searchText: buildSearchText(text, statement.group?.name, tags),
    });
  }

  return items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}
