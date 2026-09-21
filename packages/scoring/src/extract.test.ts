import { describe, expect, it } from 'vitest';
import {
  extractConversationTags,
  extractIssueTags,
  extractTextTags,
  normalize,
} from './extract.js';

const slugs = (tags: Array<{ slug: string }>) => tags.map((tag) => tag.slug);

describe('normalize', () => {
  it('keeps symbol-bearing language names distinguishable', () => {
    expect(normalize('C++')).toBe('cpp');
    expect(normalize('C#')).toBe('csharp');
    expect(normalize('.NET Core')).toBe('dotnet core');
  });

  it('joins dotted names rather than splitting them into sentences', () => {
    expect(normalize('Node.js')).toBe('nodejs');
    expect(normalize('Next.js and Socket.io')).toBe('nextjs and socketio');
  });

  it('collapses punctuation and whitespace', () => {
    expect(normalize('  Fix   the-login,  please. ')).toBe('fix the login please');
  });
});

describe('extractIssueTags', () => {
  it('reads tags from labels, title and languages with label evidence ranked highest', () => {
    const tags = extractIssueTags({
      labels: ['frontend', 'accessibility'],
      title: 'Improve keyboard navigation in the React sidebar',
      languages: { TypeScript: 74.2, CSS: 20.1, Shell: 1.2 },
    });

    expect(slugs(tags)).toContain('frontend');
    expect(slugs(tags)).toContain('accessibility');
    expect(slugs(tags)).toContain('react');
    expect(slugs(tags)).toContain('typescript');
    expect(slugs(tags)).toContain('css');

    // Shell is 1.2% of the repo, below the noise floor.
    expect(slugs(tags)).not.toContain('shell');

    const byLabel = tags.filter((tag) => tag.source === 'LABEL');
    expect(byLabel.every((tag) => tag.weight === 1)).toBe(true);

    const react = tags.find((tag) => tag.slug === 'react');
    expect(react?.weight).toBeLessThan(1);
  });

  it('prefers the longest matching alias', () => {
    const tags = extractIssueTags({ title: 'Set up React Native navigation' });
    expect(slugs(tags)).toContain('react-native');
    expect(slugs(tags)).not.toContain('react');
  });

  it('resolves aliases onto canonical slugs', () => {
    expect(slugs(extractIssueTags({ labels: ['a11y'] }))).toEqual(['accessibility']);
    expect(slugs(extractIssueTags({ labels: ['k8s'] }))).toEqual(['kubernetes']);
    expect(slugs(extractIssueTags({ labels: ['ML'] }))).toEqual(['machine-learning']);
  });

  it('takes the strongest evidence when a tag appears in several places', () => {
    const tags = extractIssueTags({
      labels: ['docker'],
      title: 'Docker build is slow',
    });
    const docker = tags.find((tag) => tag.slug === 'docker');
    expect(docker?.weight).toBe(1);
    expect(docker?.source).toBe('LABEL');
    expect(tags.filter((tag) => tag.slug === 'docker')).toHaveLength(1);
  });

  it('ignores the tail of long descriptions', () => {
    const description = `${'padding word '.repeat(300)} kubernetes`;
    expect(slugs(extractIssueTags({ description }))).not.toContain('kubernetes');
  });

  it('returns nothing for text with no taxonomy terms', () => {
    expect(extractTextTags('please review my submission when you get a chance')).toEqual([]);
  });
});

describe('extractConversationTags', () => {
  it('weights recent messages above older ones', () => {
    const tags = extractConversationTags(
      [
        { body: 'I spent all week on the Django models' },
        ...Array.from({ length: 20 }, () => ({ body: 'ok' })),
        { body: 'now the docker compose setup is broken' },
      ],
      { halfLifeMessages: 5 },
    );

    const docker = tags.find((tag) => tag.slug === 'docker');
    const django = tags.find((tag) => tag.slug === 'django');
    expect(docker).toBeDefined();
    expect(django).toBeDefined();
    expect(docker!.weight).toBeGreaterThan(django!.weight);
  });

  it('ranks a repeated topic above a passing mention', () => {
    const tags = extractConversationTags([
      { body: 'the postgres migration failed' },
      { body: 'postgres again, same error' },
      { body: 'postgres logs show a lock' },
      { body: 'unrelated figma question' },
    ]);

    expect(tags[0]?.slug).toBe('postgres');
  });

  it('handles an empty conversation', () => {
    expect(extractConversationTags([])).toEqual([]);
  });
});
