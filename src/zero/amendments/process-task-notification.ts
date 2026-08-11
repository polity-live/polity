import { fireNotification } from '../server-notify';

export function fireProcessTaskCreatedNotification(args: {
  senderId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  taskTitle: string;
}) {
  if (!args.senderId || !args.groupId) {
    return;
  }

  fireNotification('notifyProcessTaskCreated', {
    senderId: args.senderId,
    groupId: args.groupId,
    groupName: args.groupName || 'die zuständige Gruppe',
    taskTitle: args.taskTitle,
  });
}
