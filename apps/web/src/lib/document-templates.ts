import type { DocumentType } from '@studentproj/db';

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface ProseMirrorDoc {
  type: 'doc';
  content: ProseMirrorNode[];
}

export const EMPTY_DOC: ProseMirrorDoc = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

function heading(level: number, text: string): ProseMirrorNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraph(text?: string): ProseMirrorNode {
  return text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };
}

function bulletList(items: string[]): ProseMirrorNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  };
}

/// Starter structure for a new document.
///
/// The headings matter beyond looking tidy: sections are identified by their
/// heading, so a document that starts with real headings gives the soft
/// locking something to attach to from the first edit.
export function documentTemplate(type: DocumentType): ProseMirrorDoc {
  if (type === 'REPORT') {
    return {
      type: 'doc',
      content: [
        heading(2, 'Summary'),
        paragraph('One paragraph a reader outside the team can follow.'),
        heading(2, 'What we built'),
        paragraph(),
        heading(2, 'How we worked'),
        bulletList(['Who did what', 'Tools and workflow', 'What we would change']),
        heading(2, 'Results'),
        paragraph(),
        heading(2, 'Open questions'),
        bulletList(['']),
      ],
    };
  }

  if (type === 'PLAN') {
    return {
      type: 'doc',
      content: [
        heading(2, 'Goal'),
        paragraph('What this project has to be true by the end.'),
        heading(2, 'Milestones'),
        bulletList(['Milestone 1 — ', 'Milestone 2 — ', 'Milestone 3 — ']),
        heading(2, 'Who is doing what'),
        paragraph(),
        heading(2, 'Risks'),
        bulletList(['']),
        heading(2, 'Decisions'),
        paragraph(),
      ],
    };
  }

  return { type: 'doc', content: [heading(2, 'Notes'), paragraph()] };
}

/// Coerces stored JSON into something the editor can load.
///
/// `Document.contentJson` is nullable and hand-written seeds are not validated
/// by the database, so every read path has to tolerate null or a shape that is
/// not a ProseMirror document.
export function asProseMirrorDoc(value: unknown): ProseMirrorDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_DOC;
  const candidate = value as { type?: unknown; content?: unknown };
  if (candidate.type !== 'doc') return EMPTY_DOC;
  if (!Array.isArray(candidate.content)) return { type: 'doc', content: [] };
  return { type: 'doc', content: candidate.content as ProseMirrorNode[] };
}

/// True when the value looks like a ProseMirror document, used to reject
/// rubbish before it is written over a real document.
export function isProseMirrorDoc(value: unknown): value is ProseMirrorDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { type?: unknown; content?: unknown };
  return candidate.type === 'doc' && (candidate.content === undefined || Array.isArray(candidate.content));
}

function nodeText(node: ProseMirrorNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!node.content) return '';
  return node.content.map(nodeText).join('');
}

/// Flattened text of a document, for version previews and search snippets.
export function documentPlainText(value: unknown, limit = 240): string {
  const doc = asProseMirrorDoc(value);
  const text = doc.content
    .map((node) => nodeText(node).trim())
    .filter(Boolean)
    .join(' · ');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

/// Stable identifier for a heading-delimited section.
///
/// Derived from the heading text rather than its position, so inserting a
/// paragraph above a section does not silently move everyone's lock to a
/// different section. The cost is that two identically titled headings share
/// one lock, which is a far less confusing failure than locks jumping around
/// as the document is edited.
export function sectionId(headingText: string): string {
  const slug = headingText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `h:${slug}` : 'h:untitled';
}

/// Content before the first heading still needs a lockable identity.
export const INTRO_SECTION_ID = 'intro';

export interface DocumentSection {
  id: string;
  title: string;
  level: number;
}

export function documentSections(value: unknown): DocumentSection[] {
  const doc = asProseMirrorDoc(value);
  const sections: DocumentSection[] = [];

  for (const node of doc.content) {
    if (node.type !== 'heading') continue;
    const title = nodeText(node).trim();
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
    sections.push({ id: sectionId(title), title: title || 'Untitled section', level });
  }

  return sections;
}

/// Human label for a section id, for presence messages like "Sara is editing
/// Milestones".
export function sectionLabel(value: unknown, id: string): string {
  if (id === INTRO_SECTION_ID) return 'the opening';
  const match = documentSections(value).find((section) => section.id === id);
  return match?.title ?? 'a section';
}
