import type { HTMLInputTypeAttribute, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';

export interface ContactLinksField {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: HTMLInputTypeAttribute;
  helpText?: string;
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
}: ContactLinksField) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {icon}
        </div>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>
      {helpText && <p className="text-muted-foreground text-xs">{helpText}</p>}
    </div>
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
