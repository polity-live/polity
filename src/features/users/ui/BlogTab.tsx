import { featureThemeClassName } from '@/features/shared/theme';
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

export interface BlogsCardProps {
  blog: {
    id: string;
    title: string;
    date: string;
    supporters?: number;
    likes?: number; // Legacy support
    comments?: number;
    commentCount?: number;
  };
  gradientClass: string;
  href?: string;
}

export const BlogsCard: React.FC<BlogsCardProps> = ({ blog, gradientClass, href }) => {
  const cardClassName = `overflow-hidden ${gradientClass} flex h-full flex-col transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg`;

  if (href) {
    return (
      <Card asChild className={cardClassName}>
        <SmartLink href={href} className="block cursor-pointer">
          <CardHeader className="">
            <CardTitle>{blog.title}</CardTitle>
            <CardDescription>{blog.date}</CardDescription>
          </CardHeader>
          <CardFooter tone="muted" className="mt-auto flex items-center justify-between">
            <span className="flex items-center">
              <span className={featureThemeClassName('discussionsCommentTreeWarningText')}>👍</span>
              <span className="ml-1">
                {blog.supporters}
                {translateText('generated.inline.0180_supporters_dbb25078')}
              </span>
            </span>
            <span className="flex items-center">
              <span>💬</span>
              <span className="ml-1">
                {blog.comments}
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
          <span className={featureThemeClassName('discussionsCommentTreeWarningText')}>👍</span>
          <span className="ml-1">
            {blog.supporters}
            {translateText('generated.inline.0180_supporters_dbb25078')}
          </span>
        </span>
        <span className="flex items-center">
          <span>💬</span>
          <span className="ml-1">
            {blog.comments}
            {translateText('generated.inline.0181_comments_5b17a6c6')}
          </span>
        </span>
      </CardFooter>
    </Card>
  );
};
