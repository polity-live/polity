import { mutators } from '../mutators';
import { zql } from '../schema';

type CommonMutatorInput = Parameters<typeof mutators.common.addHashtag.fn>[0];
type CommonMutatorTx = CommonMutatorInput['tx'];
type CommonMutatorCtx = CommonMutatorInput['ctx'];

type HashtagEntityType = 'group' | 'event' | 'amendment' | 'blog' | 'statement';

export function normalizeHashtagTags(tags: readonly string[] | undefined) {
  return [...new Set((tags ?? []).map(tag => tag.trim()).filter(Boolean))];
}

async function loadExistingHashtagLink(
  tx: CommonMutatorTx,
  entityType: HashtagEntityType,
  entityId: string,
  hashtagId: string
) {
  switch (entityType) {
    case 'group':
      return tx.run(
        zql.group_hashtag.where('group_id', entityId).where('hashtag_id', hashtagId).one()
      );
    case 'event':
      return tx.run(
        zql.event_hashtag.where('event_id', entityId).where('hashtag_id', hashtagId).one()
      );
    case 'amendment':
      return tx.run(
        zql.amendment_hashtag.where('amendment_id', entityId).where('hashtag_id', hashtagId).one()
      );
    case 'blog':
      return tx.run(
        zql.blog_hashtag.where('blog_id', entityId).where('hashtag_id', hashtagId).one()
      );
    case 'statement':
      return tx.run(
        zql.statement_hashtag.where('statement_id', entityId).where('hashtag_id', hashtagId).one()
      );
  }
}

export async function syncEntityHashtagsForCreate(
  tx: CommonMutatorTx,
  ctx: CommonMutatorCtx,
  entityType: HashtagEntityType,
  entityId: string,
  hashtags: readonly string[] | undefined
) {
  for (const tag of normalizeHashtagTags(hashtags)) {
    const existingHashtag = await tx.run(zql.hashtag.where('tag', tag).one());
    const hashtagId = existingHashtag?.id ?? crypto.randomUUID();

    if (!existingHashtag) {
      await mutators.common.addHashtag.fn({
        tx,
        ctx,
        args: {
          id: hashtagId,
          tag,
        },
      });
    }

    const existingLink = await loadExistingHashtagLink(tx, entityType, entityId, hashtagId);

    if (existingLink) continue;

    const linkId = crypto.randomUUID();
    switch (entityType) {
      case 'group':
        await mutators.common.linkGroupHashtag.fn({
          tx,
          ctx,
          args: { id: linkId, group_id: entityId, hashtag_id: hashtagId },
        });
        break;
      case 'event':
        await mutators.common.linkEventHashtag.fn({
          tx,
          ctx,
          args: { id: linkId, event_id: entityId, hashtag_id: hashtagId },
        });
        break;
      case 'amendment':
        await mutators.common.linkAmendmentHashtag.fn({
          tx,
          ctx,
          args: { id: linkId, amendment_id: entityId, hashtag_id: hashtagId },
        });
        break;
      case 'blog':
        await mutators.common.linkBlogHashtag.fn({
          tx,
          ctx,
          args: { id: linkId, blog_id: entityId, hashtag_id: hashtagId },
        });
        break;
      case 'statement':
        await mutators.common.linkStatementHashtag.fn({
          tx,
          ctx,
          args: { id: linkId, statement_id: entityId, hashtag_id: hashtagId },
        });
        break;
    }
  }
}
