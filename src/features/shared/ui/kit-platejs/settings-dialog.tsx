/* DEMO ONLY, DO NOT USE IN PRODUCTION */

import * as React from 'react';

import { CopilotPlugin } from '@platejs/ai/react';
import { ExternalLinkIcon, Eye, EyeOff } from 'lucide-react';
import { useEditorRef } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { aiChatPlugin } from '@/features/shared/ui/kit-platejs/ai-kit.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface Model {
  label: string;
  value: string;
}

export const models: Model[] = [
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'gpt-4-turbo', value: 'gpt-4-turbo' },
  { label: 'gpt-4', value: 'gpt-4' },
  { label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
  { label: 'gpt-3.5-turbo-instruct', value: 'gpt-3.5-turbo-instruct' },
];
import { SettingsDialogView } from './SettingsDialogView';
export function SettingsDialog() {
  const editor = useEditorRef();

  const [tempModel, setTempModel] = React.useState(models[0]);
  const [tempKeys, setTempKeys] = React.useState<Record<string, string>>({
    openai: '',
  });
  const [showKey, setShowKey] = React.useState<Record<string, boolean>>({});
  const [open, setOpen] = React.useState(false);
  const [openModel, setOpenModel] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Update AI chat options
    const chatOptions = editor.getOptions(aiChatPlugin).chatOptions ?? {};
    editor.setOption(aiChatPlugin, 'chatOptions', {
      ...chatOptions,
      body: {
        ...chatOptions.body,
        apiKey: tempKeys.openai,
        model: tempModel.value,
      },
    });

    setOpen(false);

    // Update AI complete options
    const completeOptions = editor.getOptions(CopilotPlugin).completeOptions ?? {};
    editor.setOption(CopilotPlugin, 'completeOptions', {
      ...completeOptions,
      body: {
        ...completeOptions.body,
        apiKey: tempKeys.openai,
        model: tempModel.value,
      },
    });
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKey(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderApiKeyInput = (service: string, label: string) => (
    <div className="group relative">
      <div className="flex items-center justify-between">
        <label
          className="text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
          htmlFor={label}
        >
          <span className="bg-background inline-flex px-2">{label}</span>
        </label>
        <Button asChild size="icon" variant="ghost" className="absolute top-0 right-[28px] h-full">
          <a
            className="flex items-center"
            href="https://platform.openai.com/api-keys"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="size-4" />
            <span className="sr-only">
              {translateText('generated.inline.1116_get_bfffd736')}
              {label}
            </span>
          </a>
        </Button>
      </div>

      <Input
        id={label}
        className="pr-10"
        value={tempKeys[service]}
        onChange={e => setTempKeys(prev => ({ ...prev, [service]: e.target.value }))}
        placeholder=""
        data-1p-ignore
        type={showKey[service] ? 'text' : 'password'}
      />
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-0 right-0 h-full"
        onClick={() => toggleKeyVisibility(service)}
        type="button"
      >
        {showKey[service] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        <span className="sr-only">
          {showKey[service]
            ? translateText('generated.inline.0137_hide_34d8b60f')
            : translateText('generated.inline.0138_show_d97d1ee3')}{' '}
          {label}
        </span>
      </Button>
    </div>
  );
  return (
    <SettingsDialogView
      editor={editor}
      tempModel={tempModel}
      setTempModel={setTempModel}
      tempKeys={tempKeys}
      setTempKeys={setTempKeys}
      showKey={showKey}
      setShowKey={setShowKey}
      open={open}
      setOpen={setOpen}
      openModel={openModel}
      setOpenModel={setOpenModel}
      handleSubmit={handleSubmit}
      toggleKeyVisibility={toggleKeyVisibility}
      renderApiKeyInput={renderApiKeyInput}
    />
  );
}
