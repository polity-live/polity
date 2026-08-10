import { beforeEach, describe, expect, it, vi } from 'vitest';

const fireNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../../server-notify', () => ({
  fireNotification: (...args: unknown[]) => fireNotificationMock(...args),
}));

import { fireProcessTaskCreatedNotification } from '../process-task-notification';

beforeEach(() => {
  fireNotificationMock.mockReset();
});

describe('process task notification', () => {
  it.each([
    { senderId: null, groupId: 'group-1' },
    { senderId: 'user-1', groupId: null },
  ])('does not notify without sender and group', args => {
    fireProcessTaskCreatedNotification({ ...args, taskTitle: 'Task' });
    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it.each([
    ['Named Group', 'Named Group'],
    ['', 'die zuständige Gruppe'],
  ])('uses group name %s as %s', (groupName, expectedGroupName) => {
    fireProcessTaskCreatedNotification({
      senderId: 'user-1',
      groupId: 'group-1',
      groupName,
      taskTitle: 'Task',
    });

    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'user-1',
      groupId: 'group-1',
      groupName: expectedGroupName,
      taskTitle: 'Task',
    });
  });
});
