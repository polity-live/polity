export interface PreviewTarget {
  kind: 'amendment' | 'event' | 'todo';
  id: string;
}

export function previewTargetFromHref(href: string): PreviewTarget | null {
  const match = /^\/(amendment|event|todos)\/([^/?#]+)(?:[?#].*)?$/.exec(href);
  return match
    ? { kind: match[1] === 'todos' ? 'todo' : (match[1] as 'amendment' | 'event'), id: match[2] }
    : null;
}

export function previewTargetFromHash(hash: string): PreviewTarget | null {
  const match = /^preview=(amendment|event|todo):([a-zA-Z0-9_-]+)$/.exec(hash.replace(/^#/, ''));
  return match ? { kind: match[1] as PreviewTarget['kind'], id: match[2] } : null;
}

export function previewHref(target: PreviewTarget) {
  return `/${target.kind === 'todo' ? 'todos' : target.kind}/${target.id}`;
}
