import type { StudioDocument } from './document';
export interface StudioProposal {
  title: string;
  posts: {
    title: string;
    action: string;
    instagram: string;
    linkedin: string;
    facebook: string;
    slides: { title: string; text: string }[];
  }[];
}
export function applyProposal(input: StudioDocument, proposal: StudioProposal): StudioDocument {
  const doc = structuredClone(input);
  doc.title = proposal.title;
  doc.posts.forEach((p, i) => {
    const suggested = proposal.posts[i];
    if (!suggested) return;
    p.title = suggested.title;
    p.action = suggested.action;
    p.captions = {
      instagram: suggested.instagram,
      linkedin: suggested.linkedin,
      facebook: suggested.facebook,
    };
    p.pageIds.forEach((id, j) => {
      const page = doc.pages.find(v => v.id === id);
      const slide = suggested.slides[j];
      if (!page || !slide) return;
      page.name = slide.title.slice(0, 160);
      const texts = page.elements.filter(e => e.type === 'text');
      if (texts[1]) texts[1].text = slide.title;
      if (texts[2]) texts[2].text = slide.text;
    });
  });
  return doc;
}
