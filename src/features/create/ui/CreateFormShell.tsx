import { useCreateFormShellController } from '../hooks/useCreateFormShellController';
import type { CreateFormConfig } from '../types/create-form.types';
import { CreateFormShellView } from './CreateFormShellView';

interface CreateFormShellProps {
  config: CreateFormConfig;
}

/**
 * Master wrapper: reads the user's form style preference,
 * then delegates to CarouselFormLayout or OnePageFormLayout.
 */
export function CreateFormShell({ config }: CreateFormShellProps) {
  return <CreateFormShellView {...useCreateFormShellController({ config })} />;
}
