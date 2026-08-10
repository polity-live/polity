import {
  getEntityGradientClasses,
  getMotionPreset,
  getSemanticToneClasses,
} from '@/features/shared/theme';
import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/features/shared/ui/ui/card';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

export interface BlogsCardProps {
  blog: {
    id: string;
    title: string;
    date: string;
    supporters?: number;
    comments?: number;
  };
  gradientClass?: string;
  href?: string;
}

export const BlogsCard: React.FC<BlogsCardProps> = ({ blog, gradientClass, href }) => {
  const successTone = getSemanticToneClasses('success');
  const supporters = blog.supporters ?? 0;
  const comments = blog.comments ?? 0;
  const cardClassName = cn(
    'flex h-full flex-col overflow-hidden',
    gradientClass ?? getEntityGradientClasses('blog'),
    getMotionPreset('hoverLift')
  );

  if (href) {
    return (
      <Card asChild className={cardClassName}>
        <SmartLink
          href={href}
          className="block cursor-pointer"
          data-action-id="users.blog-card.open"
        >
          <CardHeader className="">
            <CardTitle>{blog.title}</CardTitle>
            <CardDescription>{blog.date}</CardDescription>
          </CardHeader>
          <CardFooter tone="muted" className="mt-auto flex items-center justify-between">
            <span className="flex items-center">
              <span className={successTone.text}>👍</span>
              <span className="ml-1">
                {supporters}
                {translateText('generated.inline.0180_supporters_dbb25078')}
              </span>
            </span>
            <span className="flex items-center">
              <span>💬</span>
              <span className="ml-1">
                {comments}
                {translateText('generated.inline.0181_comments_5b17a6c6')}
              </span>
            </span>
          </CardFooter>
        </SmartLink>
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      <CardHeader className="">
        <CardTitle>{blog.title}</CardTitle>
        <CardDescription>{blog.date}</CardDescription>
      </CardHeader>
      <CardFooter tone="muted" className="mt-auto flex items-center justify-between">
        <span className="flex items-center">
          <span className={successTone.text}>👍</span>
          <span className="ml-1">
            {supporters}
            {translateText('generated.inline.0180_supporters_dbb25078')}
          </span>
        </span>
        <span className="flex items-center">
          <span>💬</span>
          <span className="ml-1">
            {comments}
            {translateText('generated.inline.0181_comments_5b17a6c6')}
          </span>
        </span>
      </CardFooter>
    </Card>
  );
};
