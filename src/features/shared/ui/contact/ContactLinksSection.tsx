import type { HTMLInputTypeAttribute, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';

export interface ContactLinksField {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: HTMLInputTypeAttribute;
  helpText?: string;
  validator?: (value: string) => boolean;
  autoComplete?: string;
}

interface ContactLinksSectionProps {
  title: string;
  description: string;
  primaryFields?: ContactLinksField[];
  socialFields?: ContactLinksField[];
  socialTitle?: string;
  socialDescription?: string;
}

function ContactLinksFieldInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = 'text',
  helpText,
  validator,
  autoComplete,
}: ContactLinksField) {
  return (
    <ValidatedInputField
      id={id}
      type={type}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      icon={icon}
      hint={helpText}
      validator={validator}
      autoComplete={autoComplete}
    />
  );
}

export function ContactLinksSection({
  title,
  description,
  primaryFields = [],
  socialFields = [],
  socialTitle,
  socialDescription,
}: ContactLinksSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {primaryFields.length > 0 && (
          <div className={primaryFields.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
            {primaryFields.map(field => (
              <ContactLinksFieldInput key={field.id} {...field} />
            ))}
          </div>
        )}

        {socialFields.length > 0 && (
          <div className="space-y-4 border-t pt-6">
            {(socialTitle || socialDescription) && (
              <div className="space-y-1">
                {socialTitle && <p className="text-sm font-medium">{socialTitle}</p>}
                {socialDescription && (
                  <p className="text-muted-foreground text-sm">{socialDescription}</p>
                )}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {socialFields.map(field => (
                <ContactLinksFieldInput key={field.id} {...field} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
