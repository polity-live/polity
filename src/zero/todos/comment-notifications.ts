export function collectTodoCommentRecipientIds(
  creatorId: string,
  assigneeIds: readonly string[],
  senderId: string
): string[] {
  const recipients = new Set([creatorId, ...assigneeIds]);
  recipients.delete(senderId);
  return [...recipients];
}
