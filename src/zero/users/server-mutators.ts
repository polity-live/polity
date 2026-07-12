import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { fireNotification } from '../server-notify';
import { userName } from '../server-helpers';
import { followCreateSchema } from '../network/schema';

export const userServerMutators = {
  follow: defineMutator(followCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.users.follow.fn({ tx, ctx, args });
    await fireNotification('notifyNewFollower', {
      senderId: ctx.userID,
      senderName: await userName(tx, ctx.userID),
      recipientUserId: args.followee_id,
    });
  }),
};
