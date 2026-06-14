import { BlogsAndStatementsView } from '@/features/content/ui/BlogsAndStatementsView';
export interface GroupBlogsAndStatementsPageViewProps {
  groupId: any;
  t: any;
  blogs: any[];
  statements: any;
  filter: any;
  setFilter: any;
  searchQuery: any;
  setSearchQuery: any;
  canCreate: any;
  canManage: any;
  canManageBlogs: boolean;
  canCreateBlogs: boolean;
  canCreateStatements: any;
  deleteBlog: any;
  handleDeleteBlog: any;
  getEditorUrl: any;
}

export function GroupBlogsAndStatementsPageView({
  groupId,
  blogs,
  statements,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  canManageBlogs,
  canCreateBlogs,
  canCreateStatements,
  handleDeleteBlog,
  getEditorUrl,
}: GroupBlogsAndStatementsPageViewProps) {
  return (
    <BlogsAndStatementsView
      groupId={groupId}
      blogs={blogs as Parameters<typeof BlogsAndStatementsView>[0]['blogs']}
      statements={statements as Parameters<typeof BlogsAndStatementsView>[0]['statements']}
      filter={filter}
      setFilter={setFilter}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      canManage={canManageBlogs}
      canCreateBlog={canCreateBlogs}
      canCreateStatement={canCreateStatements}
      getEditorUrl={getEditorUrl}
      onDeleteBlog={handleDeleteBlog}
    />
  );
}
