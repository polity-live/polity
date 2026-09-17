export interface WorkspaceCommand {
  id: string;
  label: string;
  group: 'context' | 'favorites';
  available: boolean;
  shortcut?: string;
  href?: string;
  handler: () => void;
}

export function availableWorkspaceCommands(commands: WorkspaceCommand[]) {
  return commands.filter(command => command.available);
}
